import { Anthropic } from "@anthropic-ai/sdk";
import { serializeError } from "serialize-error";
import { slidingWindowContextManagement } from "../utils/context-management";
import { SYSTEM_PROMPT, tools } from "../shared/Constants";
import { ClaudeDev } from "../ClaudeDev";

export async function attemptApiRequest(this: ClaudeDev): Promise<Anthropic.Messages.Message> {
    try {
        let systemPrompt = SYSTEM_PROMPT();
        if (this.customInstructions && this.customInstructions.trim()) {
            systemPrompt += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`;
        }
        const adjustedMessages = slidingWindowContextManagement(
            this.api.getModel().info.contextWindow,
            systemPrompt,
            this.apiConversationHistory,
            tools
        );
        const { message, userCredits } = await this.api.createMessage(systemPrompt, adjustedMessages, tools);
        if (userCredits !== undefined) {
            console.log("Updating kodu credits", userCredits);
            this.providerRef.deref()?.updateKoduCredits(userCredits);
        }
        return message;
    } catch (error) {
        const { response } = await this.ask(
            "api_req_failed",
            error.message ?? JSON.stringify(serializeError(error), null, 2)
        );
        if (response !== "yesButtonTapped") {
            throw new Error("API request failed");
        }
        await this.say("api_req_retried");
        return this.attemptApiRequest();
    }
}