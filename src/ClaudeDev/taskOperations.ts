import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeDev } from '../ClaudeDev';
import { getPotentiallyRelevantDetails } from "./getPotentiallyRelevantDetails";
import { formatImagesIntoBlocks } from "./formatImagesIntoBlocks";
import { recursivelyMakeClaudeRequests } from "./recursivelyMakeClaudeRequests";
import { UserContent } from "./types";

export async function startTask(claudeDev: ClaudeDev, task?: string, images?: string[]): Promise<void> {
    claudeDev.claudeMessages = [];
    claudeDev.apiConversationHistory = [];
    await claudeDev.providerRef.deref()?.postStateToWebview();

    let textBlock: Anthropic.TextBlockParam = {
        type: "text",
        text: `<task>\n${task}\n</task>\n\n${getPotentiallyRelevantDetails()}`,
    };
    let imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images);
    await claudeDev.say("text", task, images);
    await initiateTaskLoop(claudeDev, [textBlock, ...imageBlocks]);
}

export async function initiateTaskLoop(claudeDev: ClaudeDev, userContent: UserContent): Promise<void> {
    let nextUserContent = userContent;

    while (!claudeDev.abort) {
        const { didEndLoop } = await recursivelyMakeClaudeRequests(claudeDev, nextUserContent);

        if (didEndLoop) {
            if (claudeDev.autoStartTask) {
                const originalTask = claudeDev.claudeMessages[0].text;
                const latestAIUpdate = claudeDev.claudeMessages[claudeDev.claudeMessages.length - 1].text;
                const newTask = `${originalTask}\n\nLatest AI Update: ${latestAIUpdate}`;
                await startTask(claudeDev, newTask);
            } else {
                break;
            }
        } else {
            nextUserContent = [
                {
                    type: "text",
                    text: "If you have completed the user's task, use the attempt_completion tool. If you require additional information from the user, use the ask_followup_question tool. Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. (This is an automated message, so do not respond to it conversationally.)",
                },
            ];
        }
    }
}