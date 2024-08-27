import { execa, ExecaError, ResultPromise } from "execa"
import { ClaudeDev } from "../ClaudeDev"
import delay from "delay"
import { serializeError } from "serialize-error"
import treeKill from "tree-kill"
import Anthropic from "@anthropic-ai/sdk"
import os from "os"
import path from "path"
import * as vscode from "vscode"

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>

export async function executeCommand(self: ClaudeDev, command?: string, returnEmptyStringOnSuccess: boolean = false): Promise<ToolResponse> {
    if (command === undefined) {
        await self.say(
            "error",
            "Claude tried to use execute_command without value for required parameter 'command'. Retrying..."
        )
        return "Error: Missing value for required parameter 'command'. Please retry with complete response."
    }
    const { response, text, images } = await self.ask("command", command)
    if (response !== "yesButtonTapped") {
        if (response === "messageResponse") {
            await self.say("user_feedback", text, images)
            return `User feedback: ${text}`
        }
        return "The user denied this operation."
    }

    const sendCommandOutput = async (subprocess: ResultPromise, line: string): Promise<void> => {
        try {
            const { response, text } = await self.ask("command_output", line)
            if (response === "yesButtonTapped") {
                if (subprocess.pid) {
                    treeKill(subprocess.pid, "SIGINT")
                }
            } else {
                subprocess.stdin?.write(text + "\n")
                sendCommandOutput(subprocess, "")
            }
        } catch {
            // This can only happen if this ask promise was ignored, so ignore this error
        }
    }

    try {
        let result = ""
        const subprocess = execa({ shell: true, cwd: cwd })`${command}`
        self.executeCommandRunningProcess = subprocess

        subprocess.stdout?.on("data", (data) => {
            if (data) {
                const output = data.toString()
                sendCommandOutput(subprocess, output)
                result += output
            }
        })

        try {
            await subprocess
        } catch (e) {
            if ((e as ExecaError).signal === "SIGINT") {
                await self.say("command_output", `\nUser exited command...`)
                result += `\n====\nUser terminated command process via SIGINT. This is not an error. Please continue with your task, but keep in mind that the command is no longer running. For example, if this command was used to start a server for a react app, the server is no longer running and you cannot open a browser to view it anymore.`
            } else {
                throw e
            }
        }
        await delay(100)
        self.executeCommandRunningProcess = undefined
        if (returnEmptyStringOnSuccess) {
            return ""
        }
        return `Command Output:\n${result}`
    } catch (e) {
        const error = e as any
        let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
        const errorString = `Error executing command:\n${errorMessage}`
        await self.say("error", `Error executing command:\n${errorMessage}`)
        self.executeCommandRunningProcess = undefined
        return errorString
    }
}