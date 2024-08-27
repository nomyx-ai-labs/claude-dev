import { Anthropic } from "@anthropic-ai/sdk"

import { execa, ExecaError, ResultPromise } from "execa"
import fs from "fs/promises"
import os from "os"
import pWaitFor from "p-wait-for"
import * as path from "path"
import { serializeError } from "serialize-error"
import treeKill from "tree-kill"
import * as vscode from "vscode"
import { ApiHandler, buildApiHandler } from "./api"
import { listFiles, parseSourceCodeForDefinitionsTopLevel } from "./parse-source-code"
import { ClaudeDevProvider } from "./providers/ClaudeDevProvider"
import { ApiConfiguration } from "./shared/api"
import { ClaudeRequestResult } from "./shared/ClaudeRequestResult"
import { DEFAULT_MAX_REQUESTS_PER_TASK, tools } from "./shared/Constants"
import { ClaudeAsk, ClaudeMessage, ClaudeSay, ClaudeSayTool } from "./shared/ExtensionMessage"
import { Tool, ToolName } from "./shared/Tool"
import { ClaudeAskResponse } from "./shared/WebviewMessage"
import delay from "delay"
import { getApiMetrics } from "./shared/getApiMetrics"
import { HistoryItem } from "./shared/HistoryItem"
import { combineApiRequests } from "./shared/combineApiRequests"
import { combineCommandSequences } from "./shared/combineCommandSequences"
import { findLastIndex } from "./utils"
import { slidingWindowContextManagement } from "./utils/context-management"
import { writeToFile } from "./ClaudeDev/writeToFile"
import { SYSTEM_PROMPT } from "./shared/Constants"
import { _calculateApiCost } from "./ClaudeDev/calculateApiCost"
import { executeCommand } from "./ClaudeDev/executeCommand"
import { recursivelyMakeClaudeRequests } from "./ClaudeDev/recursivelyMakeClaudeRequests"
import { listFilesTopLevel } from "./ClaudeDev/listFilesTopLevel"
import { listFilesRecursive } from "./ClaudeDev/listFilesRecursive"
import { viewSourceCodeDefinitionsTopLevel } from "./ClaudeDev/viewSourceCodeDefinitionsTopLevel"
import { resumeTaskFromHistory } from "./ClaudeDev/resumeTaskFromHistory"

const cwd =
	vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath).at(0) ?? path.join(os.homedir(), "Desktop")

type ToolResponse = string | Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam>
type UserContent = Array<
	Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.ToolUseBlockParam | Anthropic.ToolResultBlockParam
>

export class ClaudeDev {
	readonly taskId: string
	public api: ApiHandler
	public maxRequestsPerTask: number
	public customInstructions?: string
	public alwaysAllowReadOnly: boolean
	public requestCount = 0
	apiConversationHistory: Anthropic.MessageParam[] = []
	claudeMessages: ClaudeMessage[] = []
	public askResponse?: ClaudeAskResponse
	public askResponseText?: string
	public askResponseImages?: string[]
	public lastMessageTs?: number
	public executeCommandRunningProcess?: ResultPromise
	public providerRef: WeakRef<ClaudeDevProvider>
	public abort: boolean = false
	public requireManualConfirmation: boolean
	public autoStartTask: boolean

	constructor(
		provider: ClaudeDevProvider,
		apiConfiguration: ApiConfiguration,
		maxRequestsPerTask?: number,
		customInstructions?: string,
		alwaysAllowReadOnly?: boolean,
		task?: string,
		images?: string[],
		historyItem?: HistoryItem,
		requireManualConfirmation?: boolean,
		autoStartTask?: boolean
	) {
		this.providerRef = new WeakRef(provider)
		this.api = buildApiHandler(apiConfiguration)
		this.maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK
		this.customInstructions = customInstructions
		this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
		this.requireManualConfirmation = requireManualConfirmation ?? false
		this.autoStartTask = autoStartTask ?? true

		if (historyItem) {
			this.taskId = historyItem.id
			resumeTaskFromHistory(this)
		} else if (task || images) {
			this.taskId = Date.now().toString()
			this.startTask(task, images)
		} else {
			throw new Error("Either historyItem or task/images must be provided")
		}
	}

	updateApi(apiConfiguration: ApiConfiguration) {
		this.api = buildApiHandler(apiConfiguration)
	}

	updateMaxRequestsPerTask(maxRequestsPerTask: number | undefined) {
		this.maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK
	}

	updateCustomInstructions(customInstructions: string | undefined) {
		this.customInstructions = customInstructions
	}

	updateAlwaysAllowReadOnly(alwaysAllowReadOnly: boolean | undefined) {
		this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false
	}

	updateRequireManualConfirmation(requireManualConfirmation: boolean | undefined) {
		this.requireManualConfirmation = requireManualConfirmation ?? false
		this.saveSettings()
	}

	updateAutoStartTask(autoStartTask: boolean | undefined) {
		this.autoStartTask = autoStartTask ?? true
		this.saveSettings()
	}

	async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
		this.askResponse = askResponse
		this.askResponseText = text
		this.askResponseImages = images
	}

	// storing task to disk for history

	public async ensureTaskDirectoryExists(): Promise<string> {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const taskDir = path.join(globalStoragePath, "tasks", this.taskId)
		await fs.mkdir(taskDir, { recursive: true })
		return taskDir
	}

	public async getSavedApiConversationHistory(): Promise<Anthropic.MessageParam[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	public async addToApiConversationHistory(message: Anthropic.MessageParam) {
		this.apiConversationHistory.push(message)
		await this.saveApiConversationHistory()
	}

	public async overwriteApiConversationHistory(newHistory: Anthropic.MessageParam[]) {
		this.apiConversationHistory = newHistory
		await this.saveApiConversationHistory()
	}

	public async saveApiConversationHistory() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "api_conversation_history.json")
			await fs.writeFile(filePath, JSON.stringify(this.apiConversationHistory))
		} catch (error) {
			// in the off chance this fails, we don't want to stop the task
			console.error("Failed to save API conversation history:", error)
		}
	}

	public async getSavedClaudeMessages(): Promise<ClaudeMessage[]> {
		const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
		const fileExists = await fs
			.access(filePath)
			.then(() => true)
			.catch(() => false)
		if (fileExists) {
			return JSON.parse(await fs.readFile(filePath, "utf8"))
		}
		return []
	}

	public async addToClaudeMessages(message: ClaudeMessage) {
		this.claudeMessages.push(message)
		await this.saveClaudeMessages()
	}

	public async overwriteClaudeMessages(newMessages: ClaudeMessage[]) {
		this.claudeMessages = newMessages
		await this.saveClaudeMessages()
	}

	public async saveClaudeMessages() {
		try {
			const filePath = path.join(await this.ensureTaskDirectoryExists(), "claude_messages.json")
			await fs.writeFile(filePath, JSON.stringify(this.claudeMessages))
			// combined as they are in ChatView
			const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(this.claudeMessages.slice(1))))
			const taskMessage = this.claudeMessages[0] // first message is always the task say
			await this.providerRef.deref()?.updateTaskHistory({
				id: this.taskId,
				ts: taskMessage.ts,
				task: taskMessage.text ?? "",
				tokensIn: apiMetrics.totalTokensIn,
				tokensOut: apiMetrics.totalTokensOut,
				cacheWrites: apiMetrics.totalCacheWrites,
				cacheReads: apiMetrics.totalCacheReads,
				totalCost: apiMetrics.totalCost,
			})
		} catch (error) {
			console.error("Failed to save claude messages:", error)
		}
	}

	async ask(
		type: ClaudeAsk,
		question?: string
	): Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }> {
		// If this ClaudeDev instance was aborted by the provider, then the only thing keeping us alive is a promise still running in the background, in which case we don't want to send its result to the webview as it is attached to a new instance of ClaudeDev now. So we can safely ignore the result of any active promises, and this class will be deallocated. (Although we set claudeDev = undefined in provider, that simply removes the reference to this instance, but the instance is still alive until this promise resolves or rejects.)
		if (this.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		const askTs = Date.now()
		this.lastMessageTs = askTs
		await this.addToClaudeMessages({ ts: askTs, type: "ask", ask: type, text: question })
		await this.providerRef.deref()?.postStateToWebview()

		if (!this.requireManualConfirmation) {
			// Auto-confirm if manual confirmation is not required
			this.askResponse = "yesButtonTapped"
			this.askResponseText = ""
			this.askResponseImages = []
		} else {
			await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 })
			if (this.lastMessageTs !== askTs) {
				throw new Error("Current ask promise was ignored") // could happen if we send multiple asks in a row i.e. with command_output. It's important that when we know an ask could fail, it is handled gracefully
			}
		}

		const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages }
		this.askResponse = undefined
		this.askResponseText = undefined
		this.askResponseImages = undefined
		return result
	}

	async say(type: ClaudeSay, text?: string, images?: string[]): Promise<undefined> {
		if (this.abort) {
			throw new Error("ClaudeDev instance aborted")
		}
		const sayTs = Date.now()
		this.lastMessageTs = sayTs
		await this.addToClaudeMessages({ ts: sayTs, type: "say", say: type, text: text, images })
		await this.providerRef.deref()?.postStateToWebview()
	}

	public formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
		return images
			? images.map((dataUrl) => {
					// data:image/png;base64,base64string
					const [rest, base64] = dataUrl.split(",")
					const mimeType = rest.split(":")[1].split(";")[0]
					return {
						type: "image",
						source: { type: "base64", media_type: mimeType, data: base64 },
					} as Anthropic.ImageBlockParam
			  })
			: []
	}

	public formatIntoToolResponse(text: string, images?: string[]): ToolResponse {
		if (images && images.length > 0) {
			const textBlock: Anthropic.TextBlockParam = { type: "text", text }
			const imageBlocks: Anthropic.ImageBlockParam[] = this.formatImagesIntoBlocks(images)
			// Placing images after text leads to better results
			return [textBlock, ...imageBlocks]
		} else {
			return text
		}
	}

	public async startTask(task?: string, images?: string[]): Promise<void> {
		// conversationHistory (for API) and claudeMessages (for webview) need to be in sync
		// if the extension process were killed, then on restart the claudeMessages might not be empty, so we need to set it to [] when we create a new ClaudeDev client (otherwise webview would show stale messages from previous session)
		this.claudeMessages = []
		this.apiConversationHistory = []
		await this.providerRef.deref()?.postStateToWebview()

		let textBlock: Anthropic.TextBlockParam = {
			type: "text",
			text: `<task>\n${task}\n</task>\n\n${this.getPotentiallyRelevantDetails()}`, // cannot be sent with system prompt since it's cached and these details can change
		}
		let imageBlocks: Anthropic.ImageBlockParam[] = this.formatImagesIntoBlocks(images)
		await this.say("text", task, images)
		await this.initiateTaskLoop([textBlock, ...imageBlocks])
	}

	public async initiateTaskLoop(userContent: UserContent): Promise<void> {
		let nextUserContent = userContent

		while (!this.abort) {
			const { didEndLoop } = await recursivelyMakeClaudeRequests(this, nextUserContent)

			if (didEndLoop) {
				if (this.autoStartTask) {
					// Auto-start a new task with the original instructions and the latest AI update
					const originalTask = this.claudeMessages[0].text
					const latestAIUpdate = this.claudeMessages[this.claudeMessages.length - 1].text
					const newTask = `${originalTask}\n\nLatest AI Update: ${latestAIUpdate}`
					await this.startTask(newTask)
				} else {
					break
				}
			} else {
				nextUserContent = [
					{
						type: "text",
						text: "If you have completed the user's task, use the attempt_completion tool. If you require additional information from the user, use the ask_followup_question tool. Otherwise, if you have not completed the task and do not need additional information, then proceed with the next step of the task. (This is an automated message, so do not respond to it conversationally.)",
					},
				]
			}
		}
	}

	abortTask() {
		this.abort = true // will stop any autonomously running promises
		const runningProcessId = this.executeCommandRunningProcess?.pid
		if (runningProcessId) {
			treeKill(runningProcessId, "SIGTERM")
		}
	}

	async executeTool(toolName: ToolName, toolInput: any, isLastWriteToFile: boolean = false): Promise<ToolResponse> {
		switch (toolName) {
			case "write_to_file":
				return writeToFile(this, toolInput.path, toolInput.content, isLastWriteToFile)
			case "read_file":
				return this.readFile(toolInput.path)
			case "list_files_top_level":
				return listFilesTopLevel(this, toolInput.path)
			case "list_files_recursive":
				return listFilesRecursive(this, toolInput.path)
			case "view_source_code_definitions_top_level":
				return viewSourceCodeDefinitionsTopLevel(this, toolInput.path)
			case "execute_command":
				return executeCommand(this, toolInput.command)
			case "ask_followup_question":
				return this.askFollowupQuestion(toolInput.question)
			case "attempt_completion":
				return this.attemptCompletion(toolInput.result, toolInput.command)
			default:
				return `Unknown tool: ${toolName}`
		}
	}

	async closeDiffViews() {
		const tabs = vscode.window.tabGroups.all
			.map((tg) => tg.tabs)
			.flat()
			.filter(
				(tab) =>
					tab.input instanceof vscode.TabInputTextDiff && tab.input?.modified?.scheme === "claude-dev-diff"
			)
		for (const tab of tabs) {
			await vscode.window.tabGroups.close(tab)
		}
	}

	async readFile(relPath?: string): Promise<ToolResponse> {
		if (relPath === undefined) {
			await this.say(
				"error",
				"Claude tried to use read_file without value for required parameter 'path'. Retrying..."
			)
			return "Error: Missing value for required parameter 'path'. Please retry with complete response."
		}
		try {
			const absolutePath = path.resolve(cwd, relPath)
			const content = await fs.readFile(absolutePath, "utf-8")

			const message = JSON.stringify({
				tool: "readFile",
				path: this.getReadablePath(relPath),
				content,
			} as ClaudeSayTool)
			if (this.alwaysAllowReadOnly) {
				await this.say("tool", message)
			} else {
				const { response, text, images } = await this.ask("tool", message)
				if (response !== "yesButtonTapped") {
					if (response === "messageResponse") {
						await this.say("user_feedback", text, images)
						return this.formatIntoToolResponse(this.formatGenericToolFeedback(text), images)
					}
					return "The user denied this operation."
				}
			}

			return content
		} catch (error) {
			const errorString = `Error reading file: ${JSON.stringify(serializeError(error))}`
			await this.say(
				"error",
				`Error reading file:\n${error.message ?? JSON.stringify(serializeError(error), null, 2)}`
			)
			return errorString
		}
	}

	getReadablePath(relPath: string): string {
		// path.resolve is flexible in that it will resolve relative paths like '../../' to the cwd and even ignore the cwd if the relPath is actually an absolute path
		const absolutePath = path.resolve(cwd, relPath)
		if (cwd === path.join(os.homedir(), "Desktop")) {
			// User opened vscode without a workspace, so cwd is the Desktop. Show the full absolute path to keep the user aware of where files are being created
			return absolutePath
		}
		if (path.normalize(absolutePath) === path.normalize(cwd)) {
			return path.basename(absolutePath)
		} else {
			// show the relative path to the cwd
			const normalizedRelPath = path.relative(cwd, absolutePath)
			if (absolutePath.includes(cwd)) {
				return normalizedRelPath
			} else {
				// we are outside the cwd, so show the absolute path (useful for when claude passes in '../../' for example)
				return absolutePath
			}
		}
	}

	formatFilesList(absolutePath: string, files: string[]): string {
		const sorted = files
			.map((file) => {
				// convert absolute path to relative path
				const relativePath = path.relative(absolutePath, file)
				return file.endsWith("/") ? relativePath + "/" : relativePath
			})
			.sort((a, b) => {
				// sort directories before files
				const aIsDir = a.endsWith("/")
				const bIsDir = b.endsWith("/")
				if (aIsDir !== bIsDir) {
					return aIsDir ? -1 : 1
				}
				return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
			})

		if (sorted.length > 1000) {
			const truncatedList = sorted.slice(0, 1000).join("\n")
			const remainingCount = sorted.length - 1000
			return `${truncatedList}\n\n(${remainingCount} files not listed due to automatic truncation. Try listing files in subdirectories if you need to explore further.)`
		} else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
			return "No files found or you do not have permission to view this directory."
		} else {
			return sorted.join("\n")
		}
	}

	async askFollowupQuestion(question?: string): Promise<ToolResponse> {
		if (question === undefined) {
			await this.say(
				"error",
				"Claude tried to use ask_followup_question without value for required parameter 'question'. Retrying..."
			)
			return "Error: Missing value for required parameter 'question'. Please retry with complete response."
		}
		const { text, images } = await this.ask("followup", question)
		await this.say("user_feedback", text ?? "", images)
		return this.formatIntoToolResponse(`<answer>\n${text}\n</answer>`, images)
	}

	async attemptCompletion(result?: string, command?: string): Promise<ToolResponse> {
		// result is required, command is optional
		if (result === undefined) {
			await this.say(
				"error",
				"Claude tried to use attempt_completion without value for required parameter 'result'. Retrying..."
			)
			return "Error: Missing value for required parameter 'result'. Please retry with complete response."
		}
		let resultToSend = result
		if (command) {
			await this.say("completion_result", resultToSend)
			// TODO: currently we don't handle if this command fails, it could be useful to let claude know and retry
			const commandResult = await executeCommand(this, command, true)
			// if we received non-empty string, the command was rejected or failed
			if (commandResult) {
				return commandResult
			}
			resultToSend = ""
		}
		const { response, text, images } = await this.ask("completion_result", resultToSend) // this prompts webview to show 'new task' button, and enable text input (which would be the 'text' here)
		if (response === "yesButtonTapped") {
			return "" // signals to recursive loop to stop (for now this never happens since yesButtonTapped will trigger a new task)
		}
		await this.say("user_feedback", text ?? "", images)
		return this.formatIntoToolResponse(
			`The user is not pleased with the results. Use the feedback they provided to successfully complete the task, and then attempt completion again.\n<feedback>\n${text}\n</feedback>`,
			images
		)
	}

	async attemptApiRequest(): Promise<Anthropic.Messages.Message> {
		try {
			let systemPrompt = SYSTEM_PROMPT()
			if (this.customInstructions && this.customInstructions.trim()) {
				// altering the system prompt mid-task will break the prompt cache, but in the grand scheme this will not change often so it's better to not pollute user messages with it the way we have to with <potentially relevant details>
				systemPrompt += `
====

USER'S CUSTOM INSTRUCTIONS

The following additional instructions are provided by the user. They should be followed and given precedence in case of conflicts with previous instructions.

${this.customInstructions.trim()}
`
			}
			const adjustedMessages = slidingWindowContextManagement(
				this.api.getModel().info.contextWindow,
				systemPrompt,
				this.apiConversationHistory,
				tools
			)
			const { message, userCredits } = await this.api.createMessage(systemPrompt, adjustedMessages, tools)
			if (userCredits !== undefined) {
				console.log("Updating kodu credits", userCredits)
				this.providerRef.deref()?.updateKoduCredits(userCredits)
			}
			return message
		} catch (error) {
			const { response } = await this.ask(
				"api_req_failed",
				error.message ?? JSON.stringify(serializeError(error), null, 2)
			)
			if (response !== "yesButtonTapped") {
				// this will never happen since if noButtonTapped, we will clear current task, aborting this instance
				throw new Error("API request failed")
			}
			await this.say("api_req_retried")
			return this.attemptApiRequest()
		}
	}

	// Prompts

	getPotentiallyRelevantDetails() {
		// TODO: add more details
		return `<potentially_relevant_details>
VSCode Visible Files: ${
			vscode.window.visibleTextEditors
				?.map((editor) => editor.document?.uri?.fsPath)
				.filter(Boolean)
				.join(", ") || "(No files open)"
		}
VSCode Opened Tabs: ${
			vscode.window.tabGroups.all
				.flatMap((group) => group.tabs)
				.map((tab) => (tab.input as vscode.TabInputText)?.uri?.fsPath)
				.filter(Boolean)
				.join(", ") || "(No tabs open)"
		}
</potentially_relevant_details>`
	}

	formatGenericToolFeedback(feedback?: string) {
		return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>\n\n${this.getPotentiallyRelevantDetails()}`
	}

	async saveSettings() {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const settingsPath = path.join(globalStoragePath, "settings.json")
		const settings = {
			requireManualConfirmation: this.requireManualConfirmation,
			autoStartTask: this.autoStartTask,
		}
		await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2))
	}

	async loadSettings() {
		const globalStoragePath = this.providerRef.deref()?.context.globalStorageUri.fsPath
		if (!globalStoragePath) {
			throw new Error("Global storage uri is invalid")
		}
		const settingsPath = path.join(globalStoragePath, "settings.json")
		try {
			const settingsContent = await fs.readFile(settingsPath, "utf-8")
			const settings = JSON.parse(settingsContent)
			this.requireManualConfirmation = settings.requireManualConfirmation ?? false
			this.autoStartTask = settings.autoStartTask ?? true
		} catch (error) {
			console.error("Failed to load settings:", error)
			// If settings file doesn't exist or is invalid, use default values
			this.requireManualConfirmation = false
			this.autoStartTask = true
			// Save default settings
			await this.saveSettings()
		}
	}
}
