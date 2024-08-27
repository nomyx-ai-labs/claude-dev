import * as vscode from "vscode"
import os from "os"
import { ClaudeDev } from "../ClaudeDev"
import { ClaudeSayTool } from "../shared/ExtensionMessage"
import * as diff from "diff"
import path from "path"
import fs from "fs/promises"
import { serializeError } from "serialize-error"
import Anthropic from "@anthropic-ai/sdk"

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

export async function writeToFile(self: ClaudeDev, relPath?: string, newContent?: string, isLast: boolean = true): Promise<ToolResponse> {
    if (relPath === undefined) {
        await self.say(
            "error",
            "Claude tried to use write_to_file without value for required parameter 'path'. Retrying..."
        )
        return "Error: Missing value for required parameter 'path'. Please retry with complete response."
    }

    if (newContent === undefined) {
        await self.say(
            "error",
            `Claude tried to use write_to_file for '${relPath}' without value for required parameter 'content'. This is likely due to output token limits. Retrying...`
        )
        return "Error: Missing value for required parameter 'content'. Please retry with complete response."
    }

    try {
        const absolutePath = path.resolve(cwd, relPath)
        const fileExists = await fs
            .access(absolutePath)
            .then(() => true)
            .catch(() => false)

        if (fileExists) {
            const originalContent = await fs.readFile(absolutePath, "utf-8")
            if (originalContent.endsWith("\n") && !newContent.endsWith("\n")) {
                newContent += "\n"
            }
            const diffResult = diff.createPatch(absolutePath, originalContent, newContent)
            const diffRepresentation = diff
                .diffLines(originalContent, newContent)
                .map((part) => {
                    const prefix = part.added ? "+" : part.removed ? "-" : " "
                    return (part.value || "")
                        .split("\n")
                        .map((line) => (line ? prefix + line : ""))
                        .join("\n")
                })
                .join("")

            const fileName = path.basename(absolutePath)
            vscode.commands.executeCommand(
                "vscode.diff",
                vscode.Uri.file(absolutePath),
                vscode.Uri.parse(`claude-dev-diff:${fileName}`).with({
                    query: Buffer.from(newContent).toString("base64"),
                }),
                `${fileName}: Original ↔ Suggested Changes`
            )

            const { response, text, images } = await self.ask(
                "tool",
                JSON.stringify({
                    tool: "editedExistingFile",
                    path: getReadablePath(relPath),
                    diff: diffRepresentation,
                } as ClaudeSayTool)
            )
            if (response !== "yesButtonTapped") {
                if (isLast) {
                    await self.closeDiffViews()
                }
                if (response === "messageResponse") {
                    await self.say("user_feedback", text, images)
                    return `User feedback: ${text}`
                }
                return "The user denied this operation."
            }
            await fs.writeFile(absolutePath, newContent)
            await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
            if (isLast) {
                await self.closeDiffViews()
            }
            return `Changes applied to ${relPath}:\n${diffResult}`
        } else {
            const fileName = path.basename(absolutePath)
            vscode.commands.executeCommand(
                "vscode.diff",
                vscode.Uri.parse(`claude-dev-diff:${fileName}`).with({
                    query: Buffer.from("").toString("base64"),
                }),
                vscode.Uri.parse(`claude-dev-diff:${fileName}`).with({
                    query: Buffer.from(newContent).toString("base64"),
                }),
                `${fileName}: New File`
            )
            const { response, text, images } = await self.ask(
                "tool",
                JSON.stringify({
                    tool: "newFileCreated",
                    path: getReadablePath(relPath),
                    content: newContent,
                } as ClaudeSayTool)
            )
            if (response !== "yesButtonTapped") {
                if (isLast) {
                    await self.closeDiffViews()
                }
                if (response === "messageResponse") {
                    await self.say("user_feedback", text, images)
                    return `User feedback: ${text}`
                }
                return "The user denied this operation."
            }
            await fs.mkdir(path.dirname(absolutePath), { recursive: true })
            await fs.writeFile(absolutePath, newContent)
            await vscode.window.showTextDocument(vscode.Uri.file(absolutePath), { preview: false })
            if (isLast) {
                await self.closeDiffViews()
            }
            return `New file created and content written to ${relPath}`
        }
    } catch (error) {
        const errorString = `Error writing file: ${JSON.stringify(serializeError(error))}`
        await self.say(
            "error",
            `Error writing file:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
        )
        return errorString
    }
}

function getReadablePath(relPath: string): string {
    return path.join(cwd, relPath);
}