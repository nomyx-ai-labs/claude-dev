import { ClaudeDevProvider } from "../ClaudeDevProvider"
import { getState } from "./getState"
import * as vscode from "vscode"

export async function getStateToPostToWebview(self: ClaudeDevProvider) {
    const {
        apiConfiguration,
        maxRequestsPerTask,
        lastShownAnnouncementId,
        customInstructions,
        alwaysAllowReadOnly,
        taskHistory,
        koduCredits,
        shouldShowKoduPromo,
        requireManualConfirmation,
        autoStartTask,
    } = await getState(self)
    return {
        version: self.context.extension?.packageJSON?.version ?? "",
        apiConfiguration,
        maxRequestsPerTask,
        customInstructions,
        alwaysAllowReadOnly,
        themeName: vscode.workspace.getConfiguration("workbench").get<string>("colorTheme"),
        uriScheme: vscode.env.uriScheme,
        claudeMessages: self.claudeDev?.claudeMessages || [],
        taskHistory: (taskHistory || []).filter((item) => item.ts && item.task).sort((a, b) => b.ts - a.ts),
        shouldShowAnnouncement: lastShownAnnouncementId !== self.latestAnnouncementId,
        koduCredits,
        shouldShowKoduPromo,
        requireManualConfirmation,
        autoStartTask,
    }
}
