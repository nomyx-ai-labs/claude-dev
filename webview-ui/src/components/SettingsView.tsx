import {
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeLink,
	VSCodeTextArea,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import React, { useEffect, useState } from "react"
import { ApiConfiguration } from "../../../src/shared/api"
import { validateApiConfiguration, validateMaxRequestsPerTask } from "../utils/validate"
import { vscode } from "../utils/vscode"
import ApiOptions from "./ApiOptions"

const IS_DEV = true // Changed to true for debugging

type SettingsViewProps = {
	version: string
	apiConfiguration?: ApiConfiguration
	setApiConfiguration: React.Dispatch<React.SetStateAction<ApiConfiguration | undefined>>
	koduCredits?: number
	maxRequestsPerTask: string
	setMaxRequestsPerTask: React.Dispatch<React.SetStateAction<string>>
	customInstructions: string
	setCustomInstructions: React.Dispatch<React.SetStateAction<string>>
	onDone: () => void
	alwaysAllowReadOnly: boolean
	setAlwaysAllowReadOnly: React.Dispatch<React.SetStateAction<boolean>>
	requireManualConfirmation: boolean
	setRequireManualConfirmation: React.Dispatch<React.SetStateAction<boolean>>
	autoStartTask: boolean
	setAutoStartTask: React.Dispatch<React.SetStateAction<boolean>>
	vscodeUriScheme?: string
}

const SettingsView = ({
	version,
	apiConfiguration,
	setApiConfiguration,
	koduCredits,
	maxRequestsPerTask,
	setMaxRequestsPerTask,
	customInstructions,
	setCustomInstructions,
	onDone,
	alwaysAllowReadOnly,
	setAlwaysAllowReadOnly,
	requireManualConfirmation,
	setRequireManualConfirmation,
	autoStartTask,
	setAutoStartTask,
	vscodeUriScheme,
}: SettingsViewProps) => {
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [maxRequestsErrorMessage, setMaxRequestsErrorMessage] = useState<string | undefined>(undefined)

	const handleSubmit = () => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration)
		const maxRequestsValidationResult = validateMaxRequestsPerTask(maxRequestsPerTask)

		setApiErrorMessage(apiValidationResult)
		setMaxRequestsErrorMessage(maxRequestsValidationResult)

		if (!apiValidationResult && !maxRequestsValidationResult) {
			console.log("Submitting API configuration:", JSON.stringify(apiConfiguration, null, 2))
			vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
			vscode.postMessage({ type: "maxRequestsPerTask", text: maxRequestsPerTask })
			vscode.postMessage({ type: "customInstructions", text: customInstructions })
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({ type: "requireManualConfirmation", bool: requireManualConfirmation })
			vscode.postMessage({ type: "autoStartTask", bool: autoStartTask })
			onDone()
		}
	}

	useEffect(() => {
		setApiErrorMessage(undefined)
	}, [apiConfiguration])

	useEffect(() => {
		setMaxRequestsErrorMessage(undefined)
	}, [maxRequestsPerTask])

	useEffect(() => {
		console.log("Current API configuration:", JSON.stringify(apiConfiguration, null, 2))
	}, [apiConfiguration])

	const handleResetState = () => {
		vscode.postMessage({ type: "resetState" })
	}

	const handleLogState = () => {
		vscode.postMessage({ type: "logState" })
	}

	return (
		<div
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				padding: "10px 0px 0px 20px",
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
			}}>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "17px",
					paddingRight: 17,
				}}>
				<h3 style={{ color: "var(--vscode-foreground)", margin: 0 }}>Settings</h3>
				<VSCodeButton onClick={handleSubmit}>Done</VSCodeButton>
			</div>
			<div
				style={{ flexGrow: 1, overflowY: "scroll", paddingRight: 8, display: "flex", flexDirection: "column" }}>
				<div style={{ marginBottom: 5 }}>
					<ApiOptions
						apiConfiguration={apiConfiguration}
						setApiConfiguration={setApiConfiguration}
						showModelOptions={true}
						koduCredits={koduCredits}
						apiErrorMessage={apiErrorMessage}
						vscodeUriScheme={vscodeUriScheme}
					/>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeCheckbox
						checked={alwaysAllowReadOnly}
						onChange={(e: any) => setAlwaysAllowReadOnly(e.target.checked)}>
						<span style={{ fontWeight: "500" }}>Always allow read-only operations</span>
					</VSCodeCheckbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						When enabled, Claude will automatically read files and view directories without requiring you to
						click the Allow button.
					</p>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeCheckbox
						checked={requireManualConfirmation}
						onChange={(e: any) => setRequireManualConfirmation(e.target.checked)}>
						<span style={{ fontWeight: "500" }}>Require manual confirmation</span>
					</VSCodeCheckbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						When enabled, Claude will require manual confirmation for each task execution.
					</p>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeCheckbox
						checked={autoStartTask}
						onChange={(e: any) => setAutoStartTask(e.target.checked)}>
						<span style={{ fontWeight: "500" }}>Auto-start task</span>
					</VSCodeCheckbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						When enabled, Claude will automatically start a new task when the maximum number of requests is reached.
					</p>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeTextArea
						value={customInstructions}
						style={{ width: "100%" }}
						rows={4}
						placeholder={
							'e.g. "Run unit tests at the end", "Use TypeScript with async/await", "Speak in Spanish"'
						}
						onInput={(e: any) => setCustomInstructions(e.target?.value || "")}>
						<span style={{ fontWeight: "500" }}>Custom Instructions</span>
					</VSCodeTextArea>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						These instructions are added to the end of the system prompt sent with every request.
					</p>
				</div>

				<div>
					<VSCodeTextField
						value={maxRequestsPerTask}
						style={{ width: "100%" }}
						placeholder="20"
						onInput={(e: any) => setMaxRequestsPerTask(e.target?.value)}>
						<span style={{ fontWeight: "500" }}>Maximum # Requests Per Task</span>
					</VSCodeTextField>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						If Claude Dev reaches this limit, it will pause and ask for your permission before making
						additional requests.
					</p>
					{maxRequestsErrorMessage && (
						<p
							style={{
								fontSize: "12px",
								marginTop: "5px",
								color: "var(--vscode-errorForeground)",
							}}>
							{maxRequestsErrorMessage}
						</p>
					)}
				</div>

				{IS_DEV && (
					<>
						<div style={{ marginTop: "10px", marginBottom: "4px" }}>Debug</div>
						<VSCodeButton onClick={handleResetState} style={{ marginTop: "5px", width: "auto" }}>
							Reset State
						</VSCodeButton>
						<VSCodeButton onClick={handleLogState} style={{ marginTop: "5px", width: "auto" }}>
							Log State
						</VSCodeButton>
						<p
							style={{
								fontSize: "12px",
								marginTop: "5px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							This will reset all global state and secret storage in the extension.
						</p>
					</>
				)}

				<div
					style={{
						textAlign: "center",
						color: "var(--vscode-descriptionForeground)",
						fontSize: "12px",
						lineHeight: "1.2",
						marginTop: "auto",
						padding: "10px 8px 15px 0px",
					}}>
					<p style={{ wordWrap: "break-word", margin: 0, padding: 0 }}>
						If you have any questions or feedback, feel free to open an issue at{" "}
						<VSCodeLink href="https://github.com/saoudrizwan/claude-dev" style={{ display: "inline" }}>
							https://github.com/saoudrizwan/claude-dev
						</VSCodeLink>
					</p>
					<p style={{ fontStyle: "italic", margin: "10px 0 0 0", padding: 0 }}>v{version}</p>
				</div>
			</div>
		</div>
	)
}

export default SettingsView
