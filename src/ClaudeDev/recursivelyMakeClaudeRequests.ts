import Anthropic from "@anthropic-ai/sdk"
import { ClaudeDev } from "../ClaudeDev"
import { ClaudeRequestResult } from "../shared/ClaudeRequestResult"
import { ToolName } from "../shared/Tool"
import { _calculateApiCost } from "./calculateApiCost"

type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>


export async function recursivelyMakeClaudeRequests(self: ClaudeDev, userContent: UserContent): Promise<ClaudeRequestResult> {
    if (self.abort) {
        throw new Error("ClaudeDev instance aborted")
    }

    await self.addToApiConversationHistory({ role: "user", content: userContent })
    if (self.requestCount >= self.maxRequestsPerTask) {
        const { response } = await self.ask(
            "request_limit_reached",
            `Claude Dev has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?`
        )

        if (response === "yesButtonTapped") {
            self.requestCount = 0
        } else {
            await self.addToApiConversationHistory({
                role: "assistant",
                content: [
                    {
                        type: "text",
                        text: "Failure: I have reached the request limit for this task. Do you have a new task for me?",
                    },
                ],
            })
            return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
        }
    }

    // what the user sees in the webview
    await self.say(
        "api_req_started",
        JSON.stringify({
            request: self.api.createUserReadableRequest(userContent),
        })
    )
    try {
        const response = await self.attemptApiRequest()
        self.requestCount++

        if (self.abort) {
            throw new Error("ClaudeDev instance aborted")
        }

        let assistantResponses: Anthropic.Messages.ContentBlock[] = []
        let inputTokens = response.usage.input_tokens
        let outputTokens = response.usage.output_tokens
        let cacheCreationInputTokens =
            (response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
                .cache_creation_input_tokens || undefined
        let cacheReadInputTokens =
            (response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
                .cache_read_input_tokens || undefined
        await self.say(
            "api_req_finished",
            JSON.stringify({
                tokensIn: inputTokens,
                tokensOut: outputTokens,
                cacheWrites: cacheCreationInputTokens,
                cacheReads: cacheReadInputTokens,
                cost: _calculateApiCost(
                    self,
                    inputTokens,
                    outputTokens,
                    cacheCreationInputTokens,
                    cacheReadInputTokens
                ),
            })
        )

        // A response always returns text content blocks (it's just that before we were iterating over the completion_attempt response before we could append text response, resulting in bug)
        for (const contentBlock of response.content) {
            if (contentBlock.type === "text") {
                assistantResponses.push(contentBlock)
                await self.say("text", contentBlock.text)
            }
        }

        let toolResults: Anthropic.ToolResultBlockParam[] = []
        let attemptCompletionBlock: Anthropic.Messages.ToolUseBlock | undefined
        const writeToFileCount = response.content.filter(
            (block) => block.type === "tool_use" && (block.name as ToolName) === "write_to_file"
        ).length
        let currentWriteToFile = 0
        for (const contentBlock of response.content) {
            if (contentBlock.type === "tool_use") {
                assistantResponses.push(contentBlock)
                const toolName = contentBlock.name as ToolName
                const toolInput = contentBlock.input
                const toolUseId = contentBlock.id
                if (toolName === "attempt_completion") {
                    attemptCompletionBlock = contentBlock
                } else {
                    if (toolName === "write_to_file") {
                        currentWriteToFile++
                    }
                    // NOTE: while anthropic sdk accepts string or array of string/image, openai sdk (openrouter) only accepts a string
                    const result = await self.executeTool(
                        toolName,
                        toolInput,
                        currentWriteToFile === writeToFileCount
                    )
                    // this.say(
                    // 	"tool",
                    // 	`\nTool Used: ${toolName}\nTool Input: ${JSON.stringify(toolInput)}\nTool Result: ${result}`
                    // )
                    toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
                }
            }
        }

        if (assistantResponses.length > 0) {
            await self.addToApiConversationHistory({ role: "assistant", content: assistantResponses })
        } else {
            // self should never happen! it there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
            await self.say("error", "Unexpected Error: No assistant messages were found in the API response")
            await self.addToApiConversationHistory({
                role: "assistant",
                content: [{ type: "text", text: "Failure: I did not have a response to provide." }],
            })
        }

        let didEndLoop = false

        // attempt_completion is always done last, since there might have been other tools that needed to be called first before the job is finished
        // it's important to note that claude will order the tools logically in most cases, so we don't have to think about which tools make sense calling before others
        if (attemptCompletionBlock) {
            let result = await self.executeTool(
                attemptCompletionBlock.name as ToolName,
                attemptCompletionBlock.input
            )
            // this.say(
            // 	"tool",
            // 	`\nattempt_completion Tool Used: ${attemptCompletionBlock.name}\nTool Input: ${JSON.stringify(
            // 		attemptCompletionBlock.input
            // 	)}\nTool Result: ${result}`
            // )
            if (result === "") {
                didEndLoop = true
                result = "The user is satisfied with the result."
            }
            toolResults.push({ type: "tool_result", tool_use_id: attemptCompletionBlock.id, content: result })
        }

        if (toolResults.length > 0) {
            if (didEndLoop) {
                await self.addToApiConversationHistory({ role: "user", content: toolResults })
                await self.addToApiConversationHistory({
                    role: "assistant",
                    content: [
                        {
                            type: "text",
                            text: "I am pleased you are satisfied with the result. Do you have a new task for me?",
                        },
                    ],
                })
            } else {
                const {
                    didEndLoop: recDidEndLoop,
                    inputTokens: recInputTokens,
                    outputTokens: recOutputTokens,
                } = await recursivelyMakeClaudeRequests(self, toolResults)
                didEndLoop = recDidEndLoop
                inputTokens += recInputTokens
                outputTokens += recOutputTokens
            }
        }

        return { didEndLoop, inputTokens, outputTokens }
    } catch (error) {
        // this should never happen since the only thing that can throw an error is the attemptApiRequest, which is wrapped in a try catch that sends an ask where if noButtonTapped, will clear current task and destroy this instance. However to avoid unhandled promise rejection, we will end this loop which will end execution of this instance (see startTask)
        return { didEndLoop: true, inputTokens: 0, outputTokens: 0 }
    }
}