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
            return self.formatIntoToolResponse(self.formatGenericToolFeedback(text), images)
        }
        return "The user denied this operation."
    }

    const sendCommandOutput = async (subprocess: ResultPromise, line: string): Promise<void> => {
        try {
            const { response, text } = await self.ask("command_output", line)
            // if this ask promise is not ignored, that means the user responded to it somehow either by clicking primary button or by typing text
            if (response === "yesButtonTapped") {
                // SIGINT is typically what's sent when a user interrupts a process (like pressing Ctrl+C)
                /*
                .kill sends SIGINT by default. However by not passing any options into .kill(), execa internally sends a SIGKILL after a grace period if the SIGINT failed.
                however it turns out that even this isn't enough for certain processes like npm starting servers. therefore we use the tree-kill package to kill all processes in the process tree, including the root process.
                - Sends signal to all children processes of the process with pid pid, including pid. Signal defaults to SIGTERM.
                */
                if (subprocess.pid) {
                    //subprocess.kill("SIGINT") // will result in for loop throwing error
                    treeKill(subprocess.pid, "SIGINT")
                }
            } else {
                // if the user sent some input, we send it to the command stdin
                // add newline as cli programs expect a newline after each input
                // (stdin needs to be set to `pipe` to send input to the command, execa does this by default when using template literals - other options are inherit (from parent process stdin) or null (no stdin))
                subprocess.stdin?.write(text + "\n")
                // Recurse with an empty string to continue listening for more input
                sendCommandOutput(subprocess, "") // empty strings are effectively ignored by the webview, this is done solely to relinquish control over the exit command button
            }
        } catch {
            // This can only happen if this ask promise was ignored, so ignore this error
        }
    }

    try {
        let result = ""
        // execa by default tries to convert bash into javascript, so need to specify `shell: true` to use sh on unix or cmd.exe on windows
        // also worth noting that execa`input` and the execa(command) have nuanced differences like the template literal version handles escaping for you, while with the function call, you need to be more careful about how arguments are passed, especially when using shell: true.
        // execa returns a promise-like object that is both a promise and a Subprocess that has properties like stdin
        const subprocess = execa({ shell: true, cwd: cwd })`${command}`
        self.executeCommandRunningProcess = subprocess

        subprocess.stdout?.on("data", (data) => {
            if (data) {
                const output = data.toString()
                // stream output to user in realtime
                // do not await since it's sent as an ask and we are not waiting for a response
                sendCommandOutput(subprocess, output)
                result += output
            }
        })

        try {
            await subprocess
            // NOTE: using for await to stream execa output does not return lines that expect user input, so we use listen to the stdout stream and handle data directly, allowing us to process output as soon as it's available even before a full line is complete.
            // for await (const chunk of subprocess) {
            // 	const line = chunk.toString()
            // 	sendCommandOutput(subprocess, line)
            // 	result += `${line}\n`
            // }
        } catch (e) {
            if ((e as ExecaError).signal === "SIGINT") {
                await self.say("command_output", `\nUser exited command...`)
                result += `\n====\nUser terminated command process via SIGINT. This is not an error. Please continue with your task, but keep in mind that the command is no longer running. For example, if this command was used to start a server for a react app, the server is no longer running and you cannot open a browser to view it anymore.`
            } else {
                throw e // if the command was not terminated by user, let outer catch handle it as a real error
            }
        }
        // Wait for a short delay to ensure all messages are sent to the webview
        // This delay allows time for non-awaited promises to be created and
        // for their associated messages to be sent to the webview, maintaining
        // the correct order of messages (although the webview is smart about
        // grouping command_output messages despite any gaps anyways)
        await delay(100)
        self.executeCommandRunningProcess = undefined
        // for attemptCompletion, we don't want to return the command output
        if (returnEmptyStringOnSuccess) {
            return ""
        }
        return `Command Output:\n${result}`
    } catch (e) {
        const error = e as any
        let errorMessage = error.message || JSON.stringify(serializeError(error), null, 2)
        const errorString = `Error executing command:\n${errorMessage}`
        await self.say("error", `Error executing command:\n${errorMessage}`) // TODO: in webview show code block for command errors
        self.executeCommandRunningProcess = undefined
        return errorString
    }
}