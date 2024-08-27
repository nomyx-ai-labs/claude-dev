import Anthropic from "@anthropic-ai/sdk"
import { cwd } from "process"
import { ClaudeDev } from "../ClaudeDev"
import { ClaudeAsk } from "../shared/ExtensionMessage"
import { findLastIndex } from "../utils"

type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export async function resumeTaskFromHistory(self: ClaudeDev) {
    const modifiedClaudeMessages = await self.getSavedClaudeMessages()

    // Need to modify claude messages for good ux, i.e. if the last message is an api_request_started, then remove it otherwise the user will think the request is still loading
    const lastApiReqStartedIndex = modifiedClaudeMessages.reduce(
        (lastIndex, m, index) => (m.type === "say" && m.say === "api_req_started" ? index : lastIndex),
        -1
    )
    const lastApiReqFinishedIndex = modifiedClaudeMessages.reduce(
        (lastIndex, m, index) => (m.type === "say" && m.say === "api_req_finished" ? index : lastIndex),
        -1
    )
    if (lastApiReqStartedIndex > lastApiReqFinishedIndex && lastApiReqStartedIndex !== -1) {
        modifiedClaudeMessages.splice(lastApiReqStartedIndex, 1)
    }

    // Remove any resume messages that may have been added before
    const lastRelevantMessageIndex = findLastIndex(
        modifiedClaudeMessages,
        (m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")
    )
    if (lastRelevantMessageIndex !== -1) {
        modifiedClaudeMessages.splice(lastRelevantMessageIndex + 1)
    }

    await self.overwriteClaudeMessages(modifiedClaudeMessages)
    self.claudeMessages = await self.getSavedClaudeMessages()

    // Now present the claude messages to the user and ask if they want to resume

    const lastClaudeMessage = self.claudeMessages
        .slice()
        .reverse()
        .find((m) => !(m.ask === "resume_task" || m.ask === "resume_completed_task")) // could be multiple resume tasks

    let askType: ClaudeAsk
    if (lastClaudeMessage?.ask === "completion_result") {
        askType = "resume_completed_task"
    } else {
        askType = "resume_task"
    }

    const { response, text, images } = await self.ask(askType) // calls poststatetowebview

    let newUserContent: UserContent = []
    if (response === "messageResponse") {
        await self.say("user_feedback", text, images)
        if (images && images.length > 0) {
            newUserContent.push(...self.formatImagesIntoBlocks(images))
        }
        if (text) {
            newUserContent.push({ type: "text", text })
        }
    }

    // need to make sure that the api conversation history can be resumed by the api, even if it goes out of sync with claude messages

    // if the last message is an assistant message, we need to check if there's tool use since every tool use has to have a tool response
    // if there's no tool use and only a text block, then we can just add a user message

    // if the last message is a user message, we can need to get the assistant message before it to see if it made tool calls, and if so, fill in the remaining tool responses with 'interrupted'

    const existingApiConversationHistory: Anthropic.Messages.MessageParam[] =
        await self.getSavedApiConversationHistory()

    let modifiedOldUserContent: UserContent
    let modifiedApiConversationHistory: Anthropic.Messages.MessageParam[]
    if (existingApiConversationHistory.length > 0) {
        const lastMessage = existingApiConversationHistory[existingApiConversationHistory.length - 1]

        if (lastMessage.role === "assistant") {
            const content = Array.isArray(lastMessage.content)
                ? lastMessage.content
                : [{ type: "text", text: lastMessage.content }]
            const hasToolUse = content.some((block) => block.type === "tool_use")

            if (hasToolUse) {
                const toolUseBlocks = content.filter(
                    (block) => block.type === "tool_use"
                ) as Anthropic.Messages.ToolUseBlock[]
                const toolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => ({
                    type: "tool_result",
                    tool_use_id: block.id,
                    content: "Task was interrupted before this tool call could be completed.",
                }))
                modifiedApiConversationHistory = [...existingApiConversationHistory] // no changes
                modifiedOldUserContent = [...toolResponses]
            } else {
                modifiedApiConversationHistory = [...existingApiConversationHistory]
                modifiedOldUserContent = []
            }
        } else if (lastMessage.role === "user") {
            const previousAssistantMessage =
                existingApiConversationHistory[existingApiConversationHistory.length - 2]

            const existingUserContent: UserContent = Array.isArray(lastMessage.content)
                ? lastMessage.content
                : [{ type: "text", text: lastMessage.content }]
            if (previousAssistantMessage && previousAssistantMessage.role === "assistant") {
                const assistantContent = Array.isArray(previousAssistantMessage.content)
                    ? previousAssistantMessage.content
                    : [{ type: "text", text: previousAssistantMessage.content }]

                const toolUseBlocks = assistantContent.filter(
                    (block) => block.type === "tool_use"
                ) as Anthropic.Messages.ToolUseBlock[]

                if (toolUseBlocks.length > 0) {
                    const existingToolResults = existingUserContent.filter(
                        (block) => block.type === "tool_result"
                    ) as Anthropic.ToolResultBlockParam[]

                    const missingToolResponses: Anthropic.ToolResultBlockParam[] = toolUseBlocks
                        .filter(
                            (toolUse) => !existingToolResults.some((result) => result.tool_use_id === toolUse.id)
                        )
                        .map((toolUse) => ({
                            type: "tool_result",
                            tool_use_id: toolUse.id,
                            content: "Task was interrupted before this tool call could be completed.",
                        }))

                    modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
                    modifiedOldUserContent = [...existingUserContent, ...missingToolResponses]
                } else {
                    modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
                    modifiedOldUserContent = [...existingUserContent]
                }
            } else {
                modifiedApiConversationHistory = existingApiConversationHistory.slice(0, -1)
                modifiedOldUserContent = [...existingUserContent]
            }
        } else {
            throw new Error("Unexpected: Last message is not a user or assistant message")
        }
    } else {
        throw new Error("Unexpected: No existing API conversation history")
    }

    // now we have newUserContent which is user's current message, and the modifiedOldUserContent which is the old message with tool responses filled in
    // we need to combine them while ensuring there is only one text block
    const modifiedOldUserContentText = modifiedOldUserContent.find((block) => block.type === "text")?.text
    const newUserContentText = newUserContent.find((block) => block.type === "text")?.text
    const agoText = (() => {
        const timestamp = lastClaudeMessage?.ts ?? Date.now()
        const now = Date.now()
        const diff = now - timestamp
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(minutes / 60)
        const days = Math.floor(hours / 24)

        if (days > 0) {
            return `${days} day${days > 1 ? "s" : ""} ago`
        }
        if (hours > 0) {
            return `${hours} hour${hours > 1 ? "s" : ""} ago`
        }
        if (minutes > 0) {
            return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
        }
        return "just now"
    })()

    const combinedText =
        `Task resumption: This autonomous coding task was interrupted ${agoText}. It may or may not be complete, so please reassess the task context. Be aware that the project state may have changed since then. The current working directory is now ${cwd}. If the task has not been completed, retry the last step before interruption and proceed with completing the task.` +
        (modifiedOldUserContentText
            ? `\n\nLast recorded user input before interruption:\n<previous_message>\n${modifiedOldUserContentText}\n</previous_message>\n`
            : "") +
        (newUserContentText
            ? `\n\nNew instructions for task continuation:\n<user_message>\n${newUserContentText}\n</user_message>\n`
            : "") +
        `\n\n${self.getPotentiallyRelevantDetails()}`

    const combinedModifiedOldUserContentWithNewUserContent: UserContent = (
        modifiedOldUserContent.filter((block) => block.type !== "text") as UserContent
    ).concat([{ type: "text", text: combinedText }])

    await self.overwriteApiConversationHistory(modifiedApiConversationHistory)
    await self.initiateTaskLoop(combinedModifiedOldUserContentWithNewUserContent)
}