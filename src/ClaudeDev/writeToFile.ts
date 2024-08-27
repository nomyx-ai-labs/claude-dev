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
        // Special message for this case since this tends to happen the most
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
            // fix issue where claude always removes newline from the file
            if (originalContent.endsWith("\n") && !newContent.endsWith("\n")) {
                newContent += "\n"
            }
            // condensed patch to return to claude
            const diffResult = diff.createPatch(absolutePath, originalContent, newContent)
            // full diff representation for webview
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

            // Create virtual document with new file, then open diff editor
            const fileName = path.basename(absolutePath)
            vscode.commands.executeCommand(
                "vscode.diff",
                vscode.Uri.file(absolutePath),
                // to create a virtual doc we use a uri scheme registered in extension.ts, which then converts this base64 content into a text document
                // (providing file name with extension in the uri lets vscode know the language of the file and apply syntax highlighting)
                vscode.Uri.parse(`claude-dev-diff:${fileName}`).with({
                    query: Buffer.from(newContent).toString("base64"),
                }),
                `${fileName}: Original ↔ Suggested Changes`
            )

            const { response, text, images } = await self.ask(
                "tool",
                JSON.stringify({
                    tool: "editedExistingFile",
                    path: self.getReadablePath(relPath),
                    diff: diffRepresentation,
                } as ClaudeSayTool)
            )
            if (response !== "yesButtonTapped") {
                if (isLast) {
                    await self.closeDiffViews()
                }
                if (response === "messageResponse") {
                    await self.say("user_feedback", text, images)
                    return self.formatIntoToolResponse(self.formatGenericToolFeedback(text), images)
                }
                return "The user denied this operation."
            }
            await fs.writeFile(absolutePath, newContent)
            // Finish by opening the edited file in the editor
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
                    path: self.getReadablePath(relPath),
                    content: newContent,
                } as ClaudeSayTool)
            )
            if (response !== "yesButtonTapped") {
                if (isLast) {
                    await self.closeDiffViews()
                }
                if (response === "messageResponse") {
                    await self.say("user_feedback", text, images)
                    return self.formatIntoToolResponse(self.formatGenericToolFeedback(text), images)
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