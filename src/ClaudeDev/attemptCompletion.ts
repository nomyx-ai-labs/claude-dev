import { formatIntoToolResponse } from "./formatIntoToolResponse";
import { executeCommand } from "./executeCommand";
import { ToolResponse } from "./types";
import { ClaudeDev } from "../ClaudeDev";

export async function attemptCompletion(this: ClaudeDev, result?: string, command?: string): Promise<ToolResponse> {
    if (result === undefined) {
        await this.say(
            "error",
            "Claude tried to use attempt_completion without value for required parameter 'result'. Retrying..."
        );
        return "Error: Missing value for required parameter 'result'. Please retry with complete response.";
    }
    let resultToSend = result;
    if (command) {
        await this.say("completion_result", resultToSend);
        const commandResult = await executeCommand(this, command, true);
        if (commandResult) {
            return commandResult;
        }
        resultToSend = "";
    }
    const { response, text, images } = await this.ask("completion_result", resultToSend);
    if (response === "yesButtonTapped") {
        return "";
    }
    await this.say("user_feedback", text ?? "", images);
    return formatIntoToolResponse(
        `The user is not pleased with the results. Use the feedback they provided to successfully complete the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
        images
    );
}