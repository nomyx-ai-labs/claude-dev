import * as vscode from "vscode"
import { ClaudeDevProvider } from "../ClaudeDevProvider"
import { setWebviewMessageListener } from "./setWebviewMessageListener"

export function resolveWebviewView(
    self: ClaudeDevProvider,
    webviewView: vscode.WebviewView | vscode.WebviewPanel
    //context: vscode.WebviewViewResolveContext<unknown>, used to recreate a deallocated webview, but we don't need this since we use retainContextWhenHidden
    //token: vscode.CancellationToken
): void | Thenable<void> {
    self.outputChannel.appendLine("Resolving webview view")
    self.view = webviewView

    webviewView.webview.options = {
        // Allow scripts in the webview
        enableScripts: true,
        localResourceRoots: [self.context.extensionUri],
    }
    webviewView.webview.html = self.getHtmlContent(webviewView.webview)

    // Sets up an event listener to listen for messages passed from the webview view context
    // and executes code based on the message that is recieved
    setWebviewMessageListener(self, webviewView.webview)

    // Logs show up in bottom panel > Debug Console
    //console.log("registering listener")

    // Listen for when the panel becomes visible
    // https://github.com/microsoft/vscode-discussions/discussions/840
    if ("onDidChangeViewState" in webviewView) {
        // WebviewView and WebviewPanel have all the same properties except for this visibility listener
        // panel
        webviewView.onDidChangeViewState(
            () => {
                if (self.view?.visible) {
                    self.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
                }
            },
            null,
            self.disposables
        )
    } else if ("onDidChangeVisibility" in webviewView) {
        // sidebar
        webviewView.onDidChangeVisibility(
            () => {
                if (self.view?.visible) {
                    self.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
                }
            },
            null,
            self.disposables
        )
    }

    // Listen for when the view is disposed
    // This happens when the user closes the view or when the view is closed programmatically
    webviewView.onDidDispose(
        async () => {
            await self.dispose()
        },
        null,
        self.disposables
    )

    // Listen for when color changes
    vscode.workspace.onDidChangeConfiguration(
        (e) => {
            if (e && e.affectsConfiguration("workbench.colorTheme")) {
                // Sends latest theme name to webview
                self.postStateToWebview()
            }
        },
        null,
        self.disposables
    )

    // if the extension is starting a new session, clear previous task state
    self.clearTask()

    // Clear previous version's (0.0.6) claudeMessage cache from workspace state. We now store in global state with a unique identifier for each provider instance. We need to store globally rather than per workspace to eventually implement task history
    self.updateWorkspaceState("claudeMessages", undefined)

    self.outputChannel.appendLine("Webview view resolved")
}