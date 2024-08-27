import { Anthropic } from "@anthropic-ai/sdk"
import * as vscode from "vscode"
import { DebugProtocol } from '@vscode/debugprotocol';
import { ClaudeDev } from "../ClaudeDev"
import { ApiModelId, ApiProvider, buildApiHandler } from "../shared/api"
import { ExtensionMessage, ClaudeAction } from "../shared/ExtensionMessage"
import { WebviewMessage } from "../shared/WebviewMessage"
import { downloadTask, getNonce, getUri, selectImages } from "../utils"
import * as path from "path"
import fs from "fs/promises"
import { HistoryItem } from "../shared/HistoryItem"
import { fetchKoduCredits } from "../api/kodu"
import { resolveWebviewView } from "./ClaudeDevProvider/resolveWebviewView"
import { getState } from "./ClaudeDevProvider/getState"
import { getStateToPostToWebview } from "./ClaudeDevProvider/getStateToPostToWebview"
import { StructuredPromptManager } from "../api/structuredPromptManager"
import { listPrompts, searchPrompts, callPrompt, addPrompt, editPrompt, deletePrompt, exportPrompts, importPrompts } from "../ClaudeDev/promptManagement"
import { Prompt } from "../shared/Prompt"
import { debuggerController } from "../debugger/debuggerController"

type SecretKey = "apiKey" | "openRouterApiKey" | "awsAccessKey" | "awsSecretKey" | "koduApiKey" | "gcServiceAccountKey"
type GlobalStateKey =
	| "apiProvider"
	| "apiModelId"
	| "awsRegion"
	| "koduEmail"
	| "koduCredits"
	| "maxRequestsPerTask"
	| "lastShownAnnouncementId"
	| "customInstructions"
	| "alwaysAllowReadOnly"
	| "taskHistory"
	| "shouldShowKoduPromo"
	| "requireManualConfirmation"
	| "autoStartTask"
	| "gcProjectId"
	| "gcRegion"

export class ClaudeDevProvider implements vscode.WebviewViewProvider {
	public static readonly sideBarId = "claude-dev.SidebarProvider"
	public static readonly tabPanelId = "claude-dev.TabPanelProvider"
	public disposables: vscode.Disposable[] = []
	public view?: vscode.WebviewView | vscode.WebviewPanel
	public claudeDev?: ClaudeDev
	public latestAnnouncementId = "aug-26-2024"
	public structuredPromptManager: StructuredPromptManager

	constructor(readonly context: vscode.ExtensionContext, public readonly outputChannel: vscode.OutputChannel) {
		this.outputChannel.appendLine("ClaudeDevProvider instantiated")
		const apiHandler = buildApiHandler({ apiProvider: "anthropic" }) // You might want to get this from settings
		this.structuredPromptManager = new StructuredPromptManager(apiHandler)
	}

	resolveWebviewView(webviewView: vscode.WebviewView): Thenable<void> | void {
		resolveWebviewView(this, webviewView)
	}

	async dispose() {
		this.outputChannel.appendLine("Disposing ClaudeDevProvider...")
		await this.clearTask()
		this.outputChannel.appendLine("Cleared task")
		if (this.view && "dispose" in this.view) {
			this.view.dispose()
			this.outputChannel.appendLine("Disposed webview")
		}
		while (this.disposables.length) {
			const x = this.disposables.pop()
			if (x) {
				x.dispose()
			}
		}
		this.outputChannel.appendLine("Disposed all disposables")
	}

	async initClaudeDevWithTask(task?: string, images?: string[]) {
		await this.clearTask()
		const { maxRequestsPerTask, apiConfiguration, customInstructions, alwaysAllowReadOnly, requireManualConfirmation, autoStartTask } = await getState(this)
		this.claudeDev = new ClaudeDev(
			this,
			apiConfiguration,
			maxRequestsPerTask,
			customInstructions,
			alwaysAllowReadOnly,
			task,
			images,
			undefined,
			requireManualConfirmation,
			autoStartTask
		)
	}

	async initClaudeDevWithHistoryItem(historyItem: HistoryItem) {
		await this.clearTask()
		const { maxRequestsPerTask, apiConfiguration, customInstructions, alwaysAllowReadOnly, requireManualConfirmation, autoStartTask } = await getState(this)
		this.claudeDev = new ClaudeDev(
			this,
			apiConfiguration,
			maxRequestsPerTask,
			customInstructions,
			alwaysAllowReadOnly,
			undefined,
			undefined,
			historyItem,
			requireManualConfirmation,
			autoStartTask
		)
	}

	async postMessageToWebview(message: ExtensionMessage) {
		await this.view?.webview.postMessage(message)
	}

	public getHtmlContent(webview: vscode.Webview): string {
		const stylesUri = getUri(webview, this.context.extensionUri, [
			"webview-ui",
			"build",
			"static",
			"css",
			"main.css",
		])
		const scriptUri = getUri(webview, this.context.extensionUri, ["webview-ui", "build", "static", "js", "main.js"])
		const codiconsUri = getUri(webview, this.context.extensionUri, [
			"node_modules",
			"@vscode",
			"codicons",
			"dist",
			"codicon.css",
		])

		const nonce = getNonce()

		return /*html*/ `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
            <meta name="theme-color" content="#000000">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; img-src ${webview.cspSource} data:; script-src 'nonce-${nonce}';">
            <link rel="stylesheet" type="text/css" href="${stylesUri}">
			<link href="${codiconsUri}" rel="stylesheet" />
            <title>Claude Dev</title>
          </head>
          <body>
            <noscript>You need to enable JavaScript to run this app.</noscript>
            <div id="root"></div>
            <script nonce="${nonce}" src="${scriptUri}"></script>
          </body>
        </html>
      `
	}

	async saveKoduApiKey(apiKey: string, email?: string) {
		await this.storeSecret("koduApiKey", apiKey)
		await this.updateGlobalState("koduEmail", email)
		await this.updateGlobalState("apiProvider", "kodu")
		await this.updateGlobalState("shouldShowKoduPromo", false)
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "koduAuthenticated" })
		this.claudeDev?.updateApi({ apiProvider: "kodu", koduApiKey: apiKey })
	}

	async signOutKodu() {
		await this.storeSecret("koduApiKey", undefined)
		await this.updateGlobalState("koduEmail", undefined)
		await this.updateGlobalState("koduCredits", undefined)
		await this.updateGlobalState("apiProvider", "kodu")
		this.claudeDev?.updateApi({ apiProvider: "kodu", koduApiKey: undefined })
		await this.postStateToWebview()
	}

	async getTaskWithId(id: string): Promise<{
		historyItem: HistoryItem
		taskDirPath: string
		apiConversationHistoryFilePath: string
		claudeMessagesFilePath: string
		apiConversationHistory: Anthropic.MessageParam[]
	}> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const historyItem = history.find((item) => item.id === id)
		if (historyItem) {
			const taskDirPath = path.join(this.context.globalStorageUri.fsPath, "tasks", id)
			const apiConversationHistoryFilePath = path.join(taskDirPath, "api_conversation_history.json")
			const claudeMessagesFilePath = path.join(taskDirPath, "claude_messages.json")
			const fileExists = await fs
				.access(apiConversationHistoryFilePath)
				.then(() => true)
				.catch(() => false)
			if (fileExists) {
				const apiConversationHistory = JSON.parse(await fs.readFile(apiConversationHistoryFilePath, "utf8"))
				return {
					historyItem,
					taskDirPath,
					apiConversationHistoryFilePath,
					claudeMessagesFilePath,
					apiConversationHistory,
				}
			}
		}
		await this.deleteTaskFromState(id)
		throw new Error("Task not found")
	}

	async showTaskWithId(id: string) {
		if (id !== this.claudeDev?.taskId) {
			const { historyItem } = await this.getTaskWithId(id)
			await this.initClaudeDevWithHistoryItem(historyItem)
		}
		await this.postMessageToWebview({ type: "action", action: "chatButtonTapped" })
	}

	async exportTaskWithId(id: string) {
		const { historyItem, apiConversationHistory } = await this.getTaskWithId(id)
		await downloadTask(historyItem.ts, apiConversationHistory)
	}

	async deleteTaskWithId(id: string) {
		if (id === this.claudeDev?.taskId) {
			await this.clearTask()
		}

		const { taskDirPath, apiConversationHistoryFilePath, claudeMessagesFilePath } = await this.getTaskWithId(id)

		const apiConversationHistoryFileExists = await fs
			.access(apiConversationHistoryFilePath)
			.then(() => true)
			.catch(() => false)
		if (apiConversationHistoryFileExists) {
			await fs.unlink(apiConversationHistoryFilePath)
		}
		const claudeMessagesFileExists = await fs
			.access(claudeMessagesFilePath)
			.then(() => true)
			.catch(() => false)
		if (claudeMessagesFileExists) {
			await fs.unlink(claudeMessagesFilePath)
		}
		await fs.rmdir(taskDirPath)

		await this.deleteTaskFromState(id)
	}

	async deleteTaskFromState(id: string) {
		const taskHistory = ((await this.getGlobalState("taskHistory")) as HistoryItem[] | undefined) || []
		const updatedTaskHistory = taskHistory.filter((task) => task.id !== id)
		await this.updateGlobalState("taskHistory", updatedTaskHistory)
		await this.postStateToWebview()
	}

	async postStateToWebview() {
		const state = await getStateToPostToWebview(this)
		this.postMessageToWebview({ type: "state", state })
	}

	async clearTask() {
		this.claudeDev?.abortTask()
		this.claudeDev = undefined
	}

	async updateTaskHistory(item: HistoryItem): Promise<HistoryItem[]> {
		const history = ((await this.getGlobalState("taskHistory")) as HistoryItem[]) || []
		const existingItemIndex = history.findIndex((h) => h.id === item.id)
		if (existingItemIndex !== -1) {
			history[existingItemIndex] = item
		} else {
			history.push(item)
		}
		await this.updateGlobalState("taskHistory", history)
		return history
	}

	async updateKoduCredits(credits: number) {
		await this.updateGlobalState("koduCredits", credits)
	}

	public async updateGlobalState(key: GlobalStateKey, value: any) {
		this.outputChannel.appendLine(`Updating global state: ${key} = ${JSON.stringify(value)}`)
		await this.context.globalState.update(key, value)
	}

	public async getGlobalState(key: GlobalStateKey) {
		const value = await this.context.globalState.get(key)
		this.outputChannel.appendLine(`Getting global state: ${key} = ${JSON.stringify(value)}`)
		return value
	}

	public async updateWorkspaceState(key: string, value: any) {
		await this.context.workspaceState.update(key, value)
	}

	public async getWorkspaceState(key: string) {
		return await this.context.workspaceState.get(key)
	}

	public async storeSecret(key: SecretKey, value?: string) {
		if (value) {
			this.outputChannel.appendLine(`Storing secret: ${key}`)
			await this.context.secrets.store(key, value)
		} else {
			this.outputChannel.appendLine(`Deleting secret: ${key}`)
			await this.context.secrets.delete(key)
		}
	}

	public async getSecret(key: SecretKey) {
		const value = await this.context.secrets.get(key)
		this.outputChannel.appendLine(`Getting secret: ${key} ${value ? '(value present)' : '(no value)'}`)
		return value
	}

	async resetState() {
		vscode.window.showInformationMessage("Resetting state...")
		for (const key of this.context.globalState.keys()) {
			await this.context.globalState.update(key, undefined)
		}
		const secretKeys: SecretKey[] = ["apiKey", "openRouterApiKey", "awsAccessKey", "awsSecretKey", "koduApiKey", "gcServiceAccountKey"]
		for (const key of secretKeys) {
			await this.storeSecret(key, undefined)
		}
		if (this.claudeDev) {
			this.claudeDev.abortTask()
			this.claudeDev = undefined
		}
		vscode.window.showInformationMessage("State reset")
		await this.postStateToWebview()
		await this.postMessageToWebview({ type: "action", action: "chatButtonTapped" })
	}

	async logState() {
		const state = await getState(this)
		this.outputChannel.appendLine("Current state:")
		this.outputChannel.appendLine(JSON.stringify(state, null, 2))
		vscode.window.showInformationMessage("State logged to output channel")
	}

	// Prompt management methods
	async getPrompts(): Promise<Prompt[]> {
		return await listPrompts(this.structuredPromptManager);
	}

	async searchPrompts(query: string): Promise<Prompt[]> {
		return await searchPrompts(this.structuredPromptManager, query);
	}

	async callPrompt(name: string, request: any, state?: any): Promise<string> {
		return await callPrompt(this.structuredPromptManager, name, request, state);
	}

	async addPrompt(prompt: Prompt): Promise<void> {
		await addPrompt(this.structuredPromptManager, prompt);
		await this.postStateToWebview();
	}

	async editPrompt(name: string, updatedPrompt: Prompt): Promise<void> {
		await editPrompt(this.structuredPromptManager, name, updatedPrompt);
		await this.postStateToWebview();
	}

	async deletePrompt(name: string): Promise<void> {
		await deletePrompt(this.structuredPromptManager, name);
		await this.postStateToWebview();
	}

	async exportPrompts(): Promise<void> {
		await exportPrompts(this.structuredPromptManager);
	}

	async importPrompts(): Promise<void> {
		await importPrompts(this.structuredPromptManager);
		await this.postStateToWebview();
	}

	// Debugging methods
	async startDebugging(config: vscode.DebugConfiguration): Promise<boolean> {
		const result = await debuggerController.startDebugging(config);
		await this.postMessageToWebview({ type: "action", action: "debugSessionStarted" as ClaudeAction });
		return result;
	}

	async stopDebugging(): Promise<void> {
		await debuggerController.stopDebugging();
		await this.postMessageToWebview({ type: "action", action: "debugSessionEnded" as ClaudeAction });
	}

	async pauseDebugging(): Promise<void> {
		debuggerController.pauseDebugging();
		await this.postMessageToWebview({ type: "action", action: "debugSessionPaused" as ClaudeAction });
	}

	async addBreakpoint(filePath: string, line: number): Promise<void> {
		const uri = vscode.Uri.file(filePath);
		const location = new vscode.Location(uri, new vscode.Position(line, 0));
		debuggerController.addBreakpoint(location);
		await this.postMessageToWebview({ type: "action", action: "breakpointAdded" as ClaudeAction, data: { filePath, line } });
	}

	async removeBreakpoint(filePath: string, line: number): Promise<void> {
		const breakpoints = debuggerController.getBreakpoints();
		const breakpoint = breakpoints.find(bp => 
			bp instanceof vscode.SourceBreakpoint &&
			bp.location.uri.fsPath === filePath &&
			bp.location.range.start.line === line
		);
		if (breakpoint) {
			debuggerController.removeBreakpoint(breakpoint);
			await this.postMessageToWebview({ type: "action", action: "breakpointRemoved" as ClaudeAction, data: { filePath, line } });
		}
	}

	async getCallStack(): Promise<DebugProtocol.StackFrame[]> {
		const session = vscode.debug.activeDebugSession;
		if (session) {
			const callStack = await debuggerController.getCallStack(session);
			await this.postMessageToWebview({ type: "action", action: "callStackUpdated" as ClaudeAction, data: callStack });
			return callStack;
		}
		return [];
	}

	async getVariables(frameId: number): Promise<DebugProtocol.Variable[]> {
		const session = vscode.debug.activeDebugSession;
		if (session) {
			const variables = await debuggerController.getVariables(session, frameId);
			await this.postMessageToWebview({ type: "action", action: "variablesUpdated" as ClaudeAction, data: variables });
			return variables;
		}
		return [];
	}

	async evaluateExpression(expression: string, frameId?: number): Promise<string> {
		const session = vscode.debug.activeDebugSession;
		if (session) {
			const result = await debuggerController.evaluateExpression(session, expression, frameId);
			await this.postMessageToWebview({ type: "action", action: "expressionEvaluated" as ClaudeAction, data: { expression, result } });
			return result;
		}
		return "";
	}
}
