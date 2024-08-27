import { Anthropic } from "@anthropic-ai/sdk";
import { ApiHandler, buildApiHandler } from "./api";
import { ClaudeDevProvider } from "./providers/ClaudeDevProvider";
import { ApiConfiguration } from "./shared/api";
import { DEFAULT_MAX_REQUESTS_PER_TASK } from "./shared/Constants";
import { ClaudeMessage } from "./shared/ExtensionMessage";
import { ClaudeAskResponse } from "./shared/WebviewMessage";
import { HistoryItem } from "./shared/HistoryItem";
import { resumeTaskFromHistory } from "./ClaudeDev/resumeTaskFromHistory";
import { saveSettings } from "./ClaudeDev/fileOperations";
import { startTask } from "./ClaudeDev/taskOperations";
import { ask } from "./ClaudeDev/ask";
import { say } from "./ClaudeDev/say";
import { abortTask } from "./ClaudeDev/abortTask";
import { executeTool } from "./ClaudeDev/executeTool";
import { closeDiffViews } from "./ClaudeDev/closeDiffViews";
import { readFile } from "./ClaudeDev/readFile";
import { askFollowupQuestion } from "./ClaudeDev/askFollowupQuestion";
import { attemptCompletion } from "./ClaudeDev/attemptCompletion";
import { attemptApiRequest } from "./ClaudeDev/attemptApiRequest";
import { ResultPromise } from "execa";

export class ClaudeDev {
    readonly taskId: string;
    public api: ApiHandler;
    public maxRequestsPerTask: number;
    public customInstructions?: string;
    public alwaysAllowReadOnly: boolean;
    public requestCount = 0;
    apiConversationHistory: Anthropic.MessageParam[] = [];
    claudeMessages: ClaudeMessage[] = [];
    public askResponse?: ClaudeAskResponse;
    public askResponseText?: string;
    public askResponseImages?: string[];
    public lastMessageTs?: number;
    public executeCommandRunningProcess?: ResultPromise;
    public providerRef: WeakRef<ClaudeDevProvider>;
    public abort: boolean = false;
    public requireManualConfirmation: boolean;
    public autoStartTask: boolean;

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
        this.providerRef = new WeakRef(provider);
        this.api = buildApiHandler(apiConfiguration);
        this.maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK;
        this.customInstructions = customInstructions;
        this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false;
        this.requireManualConfirmation = requireManualConfirmation ?? false;
        this.autoStartTask = autoStartTask ?? true;

        if (historyItem) {
            this.taskId = historyItem.id;
            resumeTaskFromHistory(this);
        } else if (task || images) {
            this.taskId = Date.now().toString();
            startTask(this, task, images);
        } else {
            throw new Error("Either historyItem or task/images must be provided");
        }
    }

    updateApi(apiConfiguration: ApiConfiguration) {
        this.api = buildApiHandler(apiConfiguration);
    }

    updateMaxRequestsPerTask(maxRequestsPerTask: number | undefined) {
        this.maxRequestsPerTask = maxRequestsPerTask ?? DEFAULT_MAX_REQUESTS_PER_TASK;
    }

    updateCustomInstructions(customInstructions: string | undefined) {
        this.customInstructions = customInstructions;
    }

    updateAlwaysAllowReadOnly(alwaysAllowReadOnly: boolean | undefined) {
        this.alwaysAllowReadOnly = alwaysAllowReadOnly ?? false;
    }

    updateRequireManualConfirmation(requireManualConfirmation: boolean | undefined) {
        this.requireManualConfirmation = requireManualConfirmation ?? false;
        saveSettings(this);
    }

    updateAutoStartTask(autoStartTask: boolean | undefined) {
        this.autoStartTask = autoStartTask ?? true;
        saveSettings(this);
    }

    async handleWebviewAskResponse(askResponse: ClaudeAskResponse, text?: string, images?: string[]) {
        this.askResponse = askResponse;
        this.askResponseText = text;
        this.askResponseImages = images;
    }

    ask = ask;
    say = say;
    abortTask = abortTask;
    executeTool = executeTool;
    closeDiffViews = closeDiffViews;
    readFile = readFile;
    askFollowupQuestion = askFollowupQuestion;
    attemptCompletion = attemptCompletion;
    attemptApiRequest = attemptApiRequest;
}

// Export the helper functions from the new modules
export { saveSettings, loadSettings } from "./ClaudeDev/fileOperations";
export { startTask, initiateTaskLoop } from "./ClaudeDev/taskOperations";
export { getSavedApiConversationHistory, addToApiConversationHistory, overwriteApiConversationHistory, saveApiConversationHistory } from "./ClaudeDev/apiConversationHistory";
export { getSavedClaudeMessages, addToClaudeMessages, overwriteClaudeMessages, saveClaudeMessages } from "./ClaudeDev/claudeMessages";
