import * as vscode from "vscode"

export function getPotentiallyRelevantDetails(): string {
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