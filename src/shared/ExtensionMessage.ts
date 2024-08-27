import { ApiConfiguration } from "./api"
import { HistoryItem } from "./HistoryItem"
import { Prompt } from "./Prompt"

export interface ExtensionMessage {
	type: "action" | "state" | "selectedImages" | "prompts" | "promptSearchResults" | "promptCallResult"
	text?: string
	action?:
		| "chatButtonTapped"
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
	state?: ExtensionState
	images?: string[]
	prompts?: Prompt[]
	promptCallResult?: string
	data?: any // Add this line to include the data property
}

export type ClaudeAction = ExtensionMessage['action']

export interface ExtensionState {
	version: string
	apiConfiguration?: ApiConfiguration
	maxRequestsPerTask?: number
	customInstructions?: string
	alwaysAllowReadOnly?: boolean
	requireManualConfirmation?: boolean
	autoStartTask?: boolean
	themeName?: string
	uriScheme?: string
	claudeMessages: ClaudeMessage[]
	taskHistory: HistoryItem[]
	shouldShowAnnouncement: boolean
	koduCredits?: number
	shouldShowKoduPromo: boolean
}

export interface ClaudeMessage {
	ts: number
	type: "ask" | "say"
	ask?: ClaudeAsk
	say?: ClaudeSay
	text?: string
	images?: string[]
}

export type ClaudeAsk =
	| "request_limit_reached"
	| "followup"
	| "command"
	| "command_output"
	| "completion_result"
	| "tool"
	| "api_req_failed"
	| "resume_task"
	| "resume_completed_task"

export type ClaudeSay =
	| "task"
	| "error"
	| "api_req_started"
	| "api_req_finished"
	| "text"
	| "completion_result"
	| "user_feedback"
	| "api_req_retried"
	| "command_output"
	| "tool"

export interface ClaudeSayTool {
	tool:
		| "editedExistingFile"
		| "newFileCreated"
		| "readFile"
		| "listFilesTopLevel"
		| "listFilesRecursive"
		| "viewSourceCodeDefinitionsTopLevel"
	path?: string
	diff?: string
	content?: string
}
