import { fetchKoduCredits } from "../../api/kodu"
import { WebviewMessage } from "../../shared/WebviewMessage"
import { selectImages } from "../../utils"
import { ClaudeDevProvider } from "../ClaudeDevProvider"
import * as vscode from "vscode"
import { getStateToPostToWebview } from "./getStateToPostToWebview"
import { Prompt } from "../../shared/Prompt"

export function setWebviewMessageListener(self: ClaudeDevProvider, webview: vscode.Webview) {
	webview.onDidReceiveMessage(
		async (message: WebviewMessage) => {
			switch (message.type) {
				case "webviewDidLaunch":
					await self.postStateToWebview()
					break
				case "newTask":
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
				case "logState":
					await self.logState()
					break
				// New prompt management cases
				case "getPrompts":
					const prompts = await self.getPrompts()
					await self.postStateToWebview()
					break
				case "searchPrompts":
					if (message.text) {
						const searchResults = await self.searchPrompts(message.text)
						await self.postStateToWebview()
					}
					break
				case "callPrompt":
					if (message.promptName && message.promptRequest) {
						const result = await self.callPrompt(message.promptName, message.promptRequest, message.promptState)
						await self.postStateToWebview()
					}
					break
				case "addPrompt":
					if (message.prompt) {
						await self.addPrompt(message.prompt as Prompt)
						await self.postStateToWebview()
					}
					break
				case "editPrompt":
					if (message.promptName && message.prompt) {
						await self.editPrompt(message.promptName, message.prompt as Prompt)
						await self.postStateToWebview()
					}
					break
				case "deletePrompt":
					if (message.promptName) {
						await self.deletePrompt(message.promptName)
						await self.postStateToWebview()
					}
					break
				case "exportPrompts":
					await self.exportPrompts()
					break
				case "importPrompts":
					await self.importPrompts()
					break
			}
		},
		null,
		self.disposables
	)
}
