import React, { useCallback, useEffect, useMemo, useState } from "react"
import { useEvent } from "react-use"
import { ApiConfiguration } from "../../src/shared/api"
import { ClaudeMessage, ExtensionMessage } from "../../src/shared/ExtensionMessage"
import { HistoryItem } from "../../src/shared/HistoryItem"
import "./App.css"
import { normalizeApiConfiguration } from "./components/ApiOptions"
import ChatView from "./components/ChatView"
import HistoryView from "./components/HistoryView"
import SettingsView from "./components/SettingsView"
import WelcomeView from "./components/WelcomeView"
import { PromptManagementView } from "./components/PromptManagementView"
import { vscode } from "./utils/vscode"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import DebugControls from "./components/DebugControls"
import BreakpointList from "./components/BreakpointList"
import VariableInspector from "./components/VariableInspector"
import CallStackView from "./components/CallStackView"

const App: React.FC = () => {
	const [didHydrateState, setDidHydrateState] = useState(false)
	const [showSettings, setShowSettings] = useState(false)
	const [showHistory, setShowHistory] = useState(false)
	const [showPromptManagement, setShowPromptManagement] = useState(false)
	const [showDebugger, setShowDebugger] = useState(false)
	const [showWelcome, setShowWelcome] = useState<boolean>(false)
	const [version, setVersion] = useState<string>("")
	const [apiConfiguration, setApiConfiguration] = useState<ApiConfiguration | undefined>(undefined)
	const [maxRequestsPerTask, setMaxRequestsPerTask] = useState<string>("")
	const [customInstructions, setCustomInstructions] = useState<string>("")
	const [alwaysAllowReadOnly, setAlwaysAllowReadOnly] = useState<boolean>(false)
	const [requireManualConfirmation, setRequireManualConfirmation] = useState<boolean>(false)
	const [autoStartTask, setAutoStartTask] = useState<boolean>(false)
	const [vscodeThemeName, setVscodeThemeName] = useState<string | undefined>(undefined)
	const [vscodeUriScheme, setVscodeUriScheme] = useState<string | undefined>(undefined)
	const [claudeMessages, setClaudeMessages] = useState<ClaudeMessage[]>([])
	const [taskHistory, setTaskHistory] = useState<HistoryItem[]>([])
	const [showAnnouncement, setShowAnnouncement] = useState(false)
	const [koduCredits, setKoduCredits] = useState<number | undefined>(undefined)
	const [shouldShowKoduPromo, setShouldShowKoduPromo] = useState(true)
	const [didAuthKoduFromWelcome, setDidAuthKoduFromWelcome] = useState<boolean>(false)

	useEffect(() => {
		vscode.postMessage({ type: "webviewDidLaunch" })
	}, [])

	const handleMessage = useCallback(
		(e: MessageEvent) => {
			const message: ExtensionMessage = e.data
			switch (message.type) {
				case "state":
					setVersion(message.state!.version)
					const hasKey =
						message.state!.apiConfiguration?.apiKey !== undefined ||
						message.state!.apiConfiguration?.openRouterApiKey !== undefined ||
						message.state!.apiConfiguration?.awsAccessKey !== undefined ||
						message.state!.apiConfiguration?.koduApiKey !== undefined ||
						message.state!.apiConfiguration?.gcProjectId !== undefined
					setShowWelcome(!hasKey)
					if (!hasKey) {
						setDidAuthKoduFromWelcome(false)
					}
					setApiConfiguration(message.state!.apiConfiguration)
					setMaxRequestsPerTask(
						message.state!.maxRequestsPerTask !== undefined
							? message.state!.maxRequestsPerTask.toString()
							: ""
					)
					setCustomInstructions(message.state!.customInstructions || "")
					setAlwaysAllowReadOnly(message.state!.alwaysAllowReadOnly || false)
					setRequireManualConfirmation(message.state!.requireManualConfirmation || false)
					setAutoStartTask(message.state!.autoStartTask || false)
					setVscodeThemeName(message.state!.themeName)
					setVscodeUriScheme(message.state!.uriScheme)
					setClaudeMessages(message.state!.claudeMessages)
					setTaskHistory(message.state!.taskHistory)
					setKoduCredits(message.state!.koduCredits)
					if (message.state!.shouldShowAnnouncement) {
						setShowAnnouncement(true)
					}
					setShouldShowKoduPromo(message.state!.shouldShowKoduPromo)
					setDidHydrateState(true)
					break
				case "action":
					switch (message.action!) {
						case "settingsButtonTapped":
							setShowSettings(true)
							setShowHistory(false)
							setShowPromptManagement(false)
							setShowDebugger(false)
							break
						case "historyButtonTapped":
							setShowSettings(false)
							setShowHistory(true)
							setShowPromptManagement(false)
							setShowDebugger(false)
							break
						case "promptManagementButtonTapped":
							setShowSettings(false)
							setShowHistory(false)
							setShowPromptManagement(true)
							setShowDebugger(false)
							break
						case "debuggerButtonTapped":
							setShowSettings(false)
							setShowHistory(false)
							setShowPromptManagement(false)
							setShowDebugger(true)
							break
						case "chatButtonTapped":
							setShowSettings(false)
							setShowHistory(false)
							setShowPromptManagement(false)
							setShowDebugger(false)
							break
						case "koduCreditsFetched":
							setKoduCredits(message.state!.koduCredits)
							break
						case "koduAuthenticated":
							if (!didAuthKoduFromWelcome) {
								setShowSettings(true)
								setShowHistory(false)
								setShowPromptManagement(false)
								setShowDebugger(false)
							}
							break
					}
					break
			}
		},
		[didAuthKoduFromWelcome]
	)

	useEvent("message", handleMessage)

	const { selectedModelInfo } = useMemo(() => {
		return normalizeApiConfiguration(apiConfiguration)
	}, [apiConfiguration])

	if (!didHydrateState) {
		return null
	}

	return (
		<>
			{showWelcome ? (
				<WelcomeView
					apiConfiguration={apiConfiguration}
					setApiConfiguration={setApiConfiguration}
					vscodeUriScheme={vscodeUriScheme}
					setDidAuthKoduFromWelcome={setDidAuthKoduFromWelcome}
				/>
			) : (
				<>
					<div className="button-container">
						<VSCodeButton onClick={() => setShowSettings(true)}>Settings</VSCodeButton>
						<VSCodeButton onClick={() => setShowHistory(true)}>History</VSCodeButton>
						<VSCodeButton onClick={() => setShowPromptManagement(true)}>Manage Prompts</VSCodeButton>
						<VSCodeButton onClick={() => setShowDebugger(true)}>Debugger</VSCodeButton>
					</div>
					{showSettings && (
						<SettingsView
							version={version}
							apiConfiguration={apiConfiguration}
							setApiConfiguration={setApiConfiguration}
							koduCredits={koduCredits}
							maxRequestsPerTask={maxRequestsPerTask}
							setMaxRequestsPerTask={setMaxRequestsPerTask}
							customInstructions={customInstructions}
							setCustomInstructions={setCustomInstructions}
							alwaysAllowReadOnly={alwaysAllowReadOnly}
							setAlwaysAllowReadOnly={setAlwaysAllowReadOnly}
							requireManualConfirmation={requireManualConfirmation}
							setRequireManualConfirmation={setRequireManualConfirmation}
							autoStartTask={autoStartTask}
							setAutoStartTask={setAutoStartTask}
							onDone={() => setShowSettings(false)}
							vscodeUriScheme={vscodeUriScheme}
						/>
					)}
					{showHistory && <HistoryView taskHistory={taskHistory} onDone={() => setShowHistory(false)} />}
					{showPromptManagement && <PromptManagementView vscode={vscode} />}
					{showDebugger && (
						<div className="debugger-view">
							<DebugControls />
							<BreakpointList />
							<VariableInspector />
							<CallStackView />
						</div>
					)}
					<ChatView
						version={version}
						messages={claudeMessages}
						taskHistory={taskHistory}
						showHistoryView={() => {
							setShowSettings(false)
							setShowHistory(true)
							setShowPromptManagement(false)
							setShowDebugger(false)
						}}
						vscodeThemeName={vscodeThemeName}
						showAnnouncement={showAnnouncement}
						selectedModelSupportsImages={selectedModelInfo.supportsImages}
						selectedModelSupportsPromptCache={selectedModelInfo.supportsPromptCache}
						hideAnnouncement={() => {
							vscode.postMessage({ type: "didCloseAnnouncement" })
							setShowAnnouncement(false)
						}}
						apiConfiguration={apiConfiguration}
						vscodeUriScheme={vscodeUriScheme}
						shouldShowKoduPromo={shouldShowKoduPromo}
						koduCredits={koduCredits}
						requireManualConfirmation={requireManualConfirmation}
						autoStartTask={autoStartTask}
						isHidden={showSettings || showHistory || showPromptManagement || showDebugger}
					/>
				</>
			)}
		</>
	)
}

export default App
