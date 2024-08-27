import * as vscode from "vscode";
import { ClaudeDev } from "../ClaudeDev";

export async function closeDiffViews(this: ClaudeDev) {
    const tabs = vscode.window.tabGroups.all
        .map((tg) => tg.tabs)
        .flat()
        .filter(
            (tab) =>
                tab.input instanceof vscode.TabInputTextDiff && tab.input?.modified?.scheme === "claude-dev-diff"
        );
    for (const tab of tabs) {
        await vscode.window.tabGroups.close(tab);
    }
}