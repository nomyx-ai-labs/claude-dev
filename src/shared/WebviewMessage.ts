import { ApiConfiguration, ApiProvider } from "./api"
import { Prompt } from "./Prompt"

export interface WebviewMessage {
	type:
		| "apiConfiguration"
		| "maxRequestsPerTask"
		| "customInstructions"
		| "alwaysAllowReadOnly"
		| "webviewDidLaunch"
		| "newTask"
		| "askResponse"
		| "clearTask"
		| "didCloseAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "didClickKoduSignOut"
		| "fetchKoduCredits"
		| "didDismissKoduPromo"
		| "resetState"
		| "requireManualConfirmation"
		| "autoStartTask"
		| "logState"
		| "getPrompts"
		| "searchPrompts"
		| "callPrompt"
		| "addPrompt"
		| "editPrompt"
		| "deletePrompt"
		| "exportPrompts"
		| "importPrompts"
		| "prompts"
		| "promptSearchResults"
		| "promptCallResult"
		| "debugger"
	text?: string
	askResponse?: ClaudeAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
	promptName?: string
	promptRequest?: any
	promptState?: any
	prompt?: Prompt
	action?: "chatButtonTapped" 
		| "settingsButtonTapped" 
		| "historyButtonTapped" 
		| "didBecomeVisible" 
		| "koduAuthenticated"
		| "koduCreditsFetched" 
		| "promptManagementButtonTapped" 
		| "debugSessionStarted" 
		| "debugSessionEnded" 
		| "debugSessionPaused" 
		| "breakpointAdded" 
		| "breakpointRemoved" 
		| "callStackUpdated" 
		| "variablesUpdated" 
		| "expressionEvaluated" 
		| "debuggerButtonTapped" 
		| "getBreakpoints"
		| "removeBreakpoint"
}

export type ClaudeAskResponse = "yesButtonTapped" | "noButtonTapped" | "messageResponse"
