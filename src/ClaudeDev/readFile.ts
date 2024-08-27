import * as path from "path";
import * as fs from "fs";
import * as vscode from "vscode";
import { serializeError } from "serialize-error";
import { ClaudeSayTool } from "../shared/ExtensionMessage";
import { getReadablePath } from "./getReadablePath";
import { formatIntoToolResponse } from "./formatIntoToolResponse";
import { formatGenericToolFeedback } from "./formatGenericToolFeedback";
import { ToolResponse } from "./types";
import { ClaudeDev } from "../ClaudeDev";

const cwd =
    vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(process.env.HOME || process.env.USERPROFILE || "", "Desktop");

export async function readFile(this: ClaudeDev, relPath?: string): Promise<ToolResponse> {
    if (relPath === undefined) {
        await this.say(
            "error",
            "Claude tried to use read_file without value for required parameter 'path'. Retrying..."
        );
        return "Error: Missing value for required parameter 'path'. Please retry with complete response.";
    }
    try {
        const absolutePath = path.resolve(cwd, relPath);
        const content = await fs.promises.readFile(absolutePath, "utf-8");

        const message = JSON.stringify({
            tool: "readFile",
            path: getReadablePath(cwd, relPath),
            content,
        } as ClaudeSayTool);
        if (this.alwaysAllowReadOnly) {
            await this.say("tool", message);
        } else {
            const { response, text, images } = await this.ask("tool", message);
            if (response !== "yesButtonTapped") {
                if (response === "messageResponse") {
                    await this.say("user_feedback", text, images);
                    return formatIntoToolResponse(formatGenericToolFeedback(text), images);
                }
                return "The user denied this operation.";
            }
        }

        return content;
    } catch (error) {
        const errorString = `Error reading file: ${JSON.stringify(serializeError(error))}`;
        await this.say(
            "error",
            `Error reading file:\n${(error as Error).message ?? JSON.stringify(serializeError(error), null, 2)}`
        );
        return errorString;
    }
}