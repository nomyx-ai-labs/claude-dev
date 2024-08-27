import { formatIntoToolResponse } from "./formatIntoToolResponse";
import { ToolResponse } from "./types";
import { ClaudeDev } from "../ClaudeDev";

export async function askFollowupQuestion(this: ClaudeDev, question?: string): Promise<ToolResponse> {
    if (question === undefined) {
        await this.say(
            "error",
            "Claude tried to use ask_followup_question without value for required parameter 'question'. Retrying..."
        );
        return "Error: Missing value for required parameter 'question'. Please retry with complete response.";
    }
    const { text, images } = await this.ask("followup", question);
    await this.say("user_feedback", text ?? "", images);
    return formatIntoToolResponse(`<answer>\n${text}\n</answer>`, images);
}