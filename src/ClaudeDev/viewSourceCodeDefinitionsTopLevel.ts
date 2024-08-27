import Anthropic from "@anthropic-ai/sdk"
import path from "path"
import os from "os"
import { serializeError } from "serialize-error"
import { ClaudeDev } from "../ClaudeDev"
import { parseSourceCodeForDefinitionsTopLevel } from "../parse-source-code"
import { ClaudeSayTool } from "../shared/ExtensionMessage"
import * as vscode from "vscode"

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export async function viewSourceCodeDefinitionsTopLevel(self: ClaudeDev, relDirPath?: string): Promise<ToolResponse> {
    if (relDirPath === undefined) {
        await self.say(
            "error",
            "Claude tried to use view_source_code_definitions_top_level without value for required parameter 'path'. Retrying..."
        )
        return "Error: Missing value for required parameter 'path'. Please retry with complete response."
    }
    try {
        const absolutePath = path.resolve(cwd, relDirPath)
        const result = await parseSourceCodeForDefinitionsTopLevel(absolutePath)

        const message = JSON.stringify({
            tool: "viewSourceCodeDefinitionsTopLevel",
            path: self.getReadablePath(relDirPath),
            content: result,
        } as ClaudeSayTool)
        if (self.alwaysAllowReadOnly) {
            await self.say("tool", message)
        } else {
            const { response, text, images } = await self.ask("tool", message)
            if (response !== "yesButtonTapped") {
                if (response === "messageResponse") {
                    await self.say("user_feedback", text, images)
                    return self.formatIntoToolResponse(self.formatGenericToolFeedback(text), images)
                }
                return "The user denied this operation."
            }
        }

        return result
    } catch (error) {
        const errorString = `Error parsing source code definitions: ${JSON.stringify(serializeError(error))}`
        await self.say(
            "error",
            `Error parsing source code definitions:\n${
                error.message ?? JSON.stringify(serializeError(error), null, 2)
            }`
        )
        return errorString
    }
}
