import path from "path"
import os from "os"
import { serializeError } from "serialize-error"
import { ClaudeDev } from "../ClaudeDev"
import { listFiles } from "../parse-source-code"
import { ClaudeSayTool } from "../shared/ExtensionMessage"
import * as vscode from 'vscode';
import Anthropic from "@anthropic-ai/sdk"

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export async function listFilesTopLevel(self: ClaudeDev, relDirPath?: string): Promise<ToolResponse> {
    if (relDirPath === undefined) {
        await self.say(
            "error",
            "Claude tried to use list_files_top_level without value for required parameter 'path'. Retrying..."
        )
        return "Error: Missing value for required parameter 'path'. Please retry with complete response."
    }
    try {
        const absolutePath = path.resolve(cwd, relDirPath)
        const files = await listFiles(absolutePath, false)
        const result = formatFilesList(absolutePath, files)

        const message = JSON.stringify({
            tool: "listFilesTopLevel",
            path: getReadablePath(relDirPath),
            content: result,
        } as ClaudeSayTool)
        if (self.alwaysAllowReadOnly) {
            await self.say("tool", message)
        } else {
            const { response, text, images } = await self.ask("tool", message)
            if (response !== "yesButtonTapped") {
                if (response === "messageResponse") {
                    await self.say("user_feedback", text, images)
                    return `User feedback: ${text}`
                }
                return "The user denied this operation."
            }
        }

        return result
    } catch (error) {
        const errorString = `Error listing files and directories: ${JSON.stringify(serializeError(error))}`
        await self.say(
            "error",
            `Error listing files and directories:\n${
                error.message ?? JSON.stringify(serializeError(error), null, 2)
            }`
        )
        return errorString
    }
}

function formatFilesList(basePath: string, files: string[]): string {
    return files.map(file => path.relative(basePath, file)).join('\n');
}

function getReadablePath(relPath: string): string {
    return path.join(cwd, relPath);
}