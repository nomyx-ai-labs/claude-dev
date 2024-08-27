import Anthropic from "@anthropic-ai/sdk"
import { ClaudeDev } from "../ClaudeDev"
import { ClaudeRequestResult } from "../shared/ClaudeRequestResult"
import { ToolName } from "../shared/Tool"
import { _calculateApiCost } from "./calculateApiCost"
import * as debugSession from "./debugSession"
import { debuggerController } from "../debugger/debuggerController"
import * as vscode from "vscode"

type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

function isDebuggingTask(content: UserContent): boolean {
    const debugKeywords = ["debug", "breakpoint", "step", "inspect", "variable", "call stack"];
    return content.some(block => 
        block.type === "text" && 
        debugKeywords.some(keyword => block.text.toLowerCase().includes(keyword))
    );
}

async function handleDebuggingTask(self: ClaudeDev, content: UserContent): Promise<ClaudeRequestResult> {
    // Initialize debugging session if not already active
    if (!debugSession.isDebugging()) {
        await self.say("text", "Initializing debug session...");
        const config = await vscode.debug.startDebugging(undefined, {
            type: 'node',
            request: 'launch',
            name: 'Debug Task',
            program: '${file}'
        });
        if (!config) {
            await self.say("text", "Failed to start debugging session.");
            return { didEndLoop: false, inputTokens: 0, outputTokens: 0 };
        }
    }

    // Process debugging commands
    for (const block of content) {
        if (block.type === "text") {
            const text = block.text.toLowerCase();
            if (text.includes("breakpoint")) {
                const match = text.match(/breakpoint.*line\s+(\d+)/i);
                if (match) {
                    const lineNumber = parseInt(match[1], 10);
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const position = new vscode.Position(lineNumber - 1, 0);
                        const location = new vscode.Location(activeEditor.document.uri, position);
                        debuggerController.addBreakpoint(location);
                        await self.say("text", `Breakpoint added at line ${lineNumber}`);
                    } else {
                        await self.say("text", "No active editor to add breakpoint");
                    }
                } else {
                    await self.say("text", "Could not determine line number for breakpoint");
                }
            } else if (text.includes("step")) {
                if (text.includes("over")) {
                    await debugSession.stepOver();
                    await self.say("text", "Stepped over");
                } else if (text.includes("into")) {
                    await debugSession.stepInto();
                    await self.say("text", "Stepped into");
                } else if (text.includes("out")) {
                    await debugSession.stepOut();
                    await self.say("text", "Stepped out");
                }
            } else if (text.includes("inspect") || text.includes("variable")) {
                const session = debuggerController.getActiveDebugSession();
                if (session) {
                    const stackTrace = await debuggerController.getCallStack(session);
                    if (stackTrace.length > 0) {
                        const variables = await debuggerController.getVariables(session, stackTrace[0].id);
                        const variableInfo = variables.map(v => `${v.name}: ${v.value}`).join('\n');
                        await self.say("text", `Current variables:\n${variableInfo}`);
                    } else {
                        await self.say("text", "No active stack frame to inspect variables");
                    }
                } else {
                    await self.say("text", "No active debug session to inspect variables");
                }
            } else if (text.includes("call stack")) {
                const session = debuggerController.getActiveDebugSession();
                if (session) {
                    const stackTrace = await debuggerController.getCallStack(session);
                    const stackInfo = stackTrace.map(frame => `${frame.name} (${frame.source?.path}:${frame.line})`).join('\n');
                    await self.say("text", `Current call stack:\n${stackInfo}`);
                } else {
                    await self.say("text", "No active debug session to get call stack");
                }
            }
        }
    }

    // Provide debugging information back to the user
    const debugInfo = "Debug session is active. You can use commands like 'add breakpoint', 'step over', 'inspect variables', or 'show call stack'.";
    await self.say("text", debugInfo);

    return { didEndLoop: false, inputTokens: 0, outputTokens: 0 };
}

export async function recursivelyMakeClaudeRequests(self: ClaudeDev, userContent: UserContent): Promise<ClaudeRequestResult> {
    if (self.abort) {
        throw new Error("ClaudeDev instance aborted")
    }

    self.apiConversationHistory.push({ role: "user", content: userContent })
    if (self.requestCount >= self.maxRequestsPerTask) {
        const { response } = await self.ask(
            "request_limit_reached",
            `Claude Dev has reached the maximum number of requests for this task. Would you like to reset the count and allow him to proceed?`
        )

        if (response === "yesButtonTapped") {
            self.requestCount = 0
        } else {
            self.apiConversationHistory.push({
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

    // Check if this is a debugging task
    if (isDebuggingTask(userContent)) {
        return handleDebuggingTask(self, userContent);
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
                ?.cache_creation_input_tokens || undefined
        let cacheReadInputTokens =
            (response as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessage).usage
                ?.cache_read_input_tokens || undefined
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
                    toolResults.push({ type: "tool_result", tool_use_id: toolUseId, content: result })
                }
            }
        }

        if (assistantResponses.length > 0) {
            self.apiConversationHistory.push({ role: "assistant", content: assistantResponses })
        } else {
            // self should never happen! it there's no assistant_responses, that means we got no text or tool_use content blocks from API which we should assume is an error
            await self.say("error", "Unexpected Error: No assistant messages were found in the API response")
            self.apiConversationHistory.push({
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
            if (result === "") {
                didEndLoop = true
                result = "The user is satisfied with the result."
            }
            toolResults.push({ type: "tool_result", tool_use_id: attemptCompletionBlock.id, content: result })
        }

        if (toolResults.length > 0) {
            if (didEndLoop) {
                self.apiConversationHistory.push({ role: "user", content: toolResults })
                self.apiConversationHistory.push({
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