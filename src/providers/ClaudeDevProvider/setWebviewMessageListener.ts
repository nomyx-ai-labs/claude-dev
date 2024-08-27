import { fetchKoduCredits } from "../../api/kodu"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { selectImages } from "../../utils"
import { ClaudeDevProvider } from "../ClaudeDevProvider"
import * as vscode from "vscode"
import { getStateToPostToWebview } from "./getStateToPostToWebview"

	/**
	 * Sets up an event listener to listen for messages passed from the webview context and
	 * executes code based on the message that is recieved.
	 *
	 * @param webview A reference to the extension webview
	 */
	export function setWebviewMessageListener(self: ClaudeDevProvider, webview: vscode.Webview) {
		webview.onDidReceiveMessage(
			async (message: WebviewMessage) => {
				switch (message.type) {
					case "webviewDidLaunch":
						await self.postStateToWebview()
						break
					case "newTask":
						// Code that should run in response to the hello message command
						//vscode.window.showInformationMessage(message.text!)

						// Send a message to our webview.
						// You can send any JSON serializable data.
						// Could also do self in extension .ts
						//self.postMessageToWebview({ type: "text", text: `Extension: ${Date.now()}` })
						// initializing new instance of ClaudeDev will make sure that any agentically running promises in old instance don't affect our new task. self essentially creates a fresh slate for the new task
						await self.initClaudeDevWithTask(message.text, message.images)
						break
					case "apiConfiguration":
						if (message.apiConfiguration) {
							const {
								apiProvider,
								apiModelId,
								apiKey,
								openRouterApiKey,
								awsAccessKey,
								awsSecretKey,
								awsRegion,
								gcProjectId,
								gcRegion,
								gcServiceAccountKey,
							} = message.apiConfiguration
							await self.updateGlobalState("apiProvider", apiProvider)
							await self.updateGlobalState("apiModelId", apiModelId)
							await self.storeSecret("apiKey", apiKey)
							await self.storeSecret("openRouterApiKey", openRouterApiKey)
							await self.storeSecret("awsAccessKey", awsAccessKey)
							await self.storeSecret("awsSecretKey", awsSecretKey)
							await self.updateGlobalState("awsRegion", awsRegion)
							await self.updateGlobalState("gcProjectId", gcProjectId)
							await self.updateGlobalState("gcRegion", gcRegion)
							await self.storeSecret("gcServiceAccountKey", gcServiceAccountKey)
							self.claudeDev?.updateApi(message.apiConfiguration)
						}
						await self.postStateToWebview()
						break
					case "maxRequestsPerTask":
						let result: number | undefined = undefined
						if (message.text && message.text.trim()) {
							const num = Number(message.text)
							if (!isNaN(num)) {
								result = num
							}
						}
						await self.updateGlobalState("maxRequestsPerTask", result)
						self.claudeDev?.updateMaxRequestsPerTask(result)
						await self.postStateToWebview()
						break
					case "customInstructions":
						// User may be clearing the field
						await self.updateGlobalState("customInstructions", message.text || undefined)
						self.claudeDev?.updateCustomInstructions(message.text || undefined)
						await self.postStateToWebview()
						break
					case "alwaysAllowReadOnly":
						await self.updateGlobalState("alwaysAllowReadOnly", message.bool ?? undefined)
						self.claudeDev?.updateAlwaysAllowReadOnly(message.bool ?? undefined)
						await self.postStateToWebview()
						break
					case "askResponse":
						self.claudeDev?.handleWebviewAskResponse(message.askResponse!, message.text, message.images)
						break
					case "clearTask":
						// newTask will start a new task with a given task text, while clear task resets the current session and allows for a new task to be started
						await self.clearTask()
						await self.postStateToWebview()
						break
					case "didCloseAnnouncement":
						await self.updateGlobalState("lastShownAnnouncementId", self.latestAnnouncementId)
						await self.postStateToWebview()
						break
					case "selectImages":
						const images = await selectImages()
						await self.postMessageToWebview({ type: "selectedImages", images })
						break
					case "exportCurrentTask":
						const currentTaskId = self.claudeDev?.taskId
						if (currentTaskId) {
							self.exportTaskWithId(currentTaskId)
						}
						break
					case "showTaskWithId":
						self.showTaskWithId(message.text!)
						break
					case "deleteTaskWithId":
						self.deleteTaskWithId(message.text!)
						break
					case "exportTaskWithId":
						self.exportTaskWithId(message.text!)
						break
					case "didClickKoduSignOut":
						await self.signOutKodu()
						break
					case "fetchKoduCredits":
						const koduApiKey = await self.getSecret("koduApiKey")
						if (koduApiKey) {
							const credits = await fetchKoduCredits({ apiKey: koduApiKey })
							await self.updateGlobalState("koduCredits", credits)
							await self.postMessageToWebview({
								type: "action",
								action: "koduCreditsFetched",
								state: await getStateToPostToWebview(self),
							})
						}
						break
					case "didDismissKoduPromo":
						await self.updateGlobalState("shouldShowKoduPromo", false)
						await self.postStateToWebview()
						break
					case "resetState":
						await self.resetState()
						break
					// Add more switch case statements here as more webview message commands
					// are created within the webview context (i.e. inside media/main.js)
				}
			},
			null,
			self.disposables
		)
	}
