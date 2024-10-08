import {
	VSCodeButton,
	VSCodeCheckbox,
	VSCodeLink,
	VSCodeTextArea,
	VSCodeTextField,
} from "@vscode/webview-ui-toolkit/react"
import { useEffect, useState } from "react"
import { useExtensionState } from "../context/ExtensionStateContext"
import { validateApiConfiguration, validateMaxRequestsPerTask } from "../utils/validate"
import { vscode } from "../utils/vscode"
import ApiOptions from "./ApiOptions"

const IS_DEV = false // FIXME: use flags when packaging

type SettingsViewProps = {
	onDone: () => void
}

const SettingsView = ({ onDone }: SettingsViewProps) => {
	const {
		apiConfiguration,
		version,
		maxRequestsPerTask,
		customInstructions,
		setCustomInstructions,
		alwaysAllowReadOnly,
		setAlwaysAllowReadOnly,
		automaticallyRunTasks,
		setAutomaticallyRunTasks,
	} = useExtensionState()
	const [apiErrorMessage, setApiErrorMessage] = useState<string | undefined>(undefined)
	const [maxRequestsErrorMessage, setMaxRequestsErrorMessage] = useState<string | undefined>(undefined)
	const [maxRequestsPerTaskString, setMaxRequestsPerTaskString] = useState<string>(
		maxRequestsPerTask?.toString() || ""
	)

	const handleSubmit = () => {
		const apiValidationResult = validateApiConfiguration(apiConfiguration)
		const maxRequestsValidationResult = validateMaxRequestsPerTask(maxRequestsPerTaskString)

		setApiErrorMessage(apiValidationResult)
		setMaxRequestsErrorMessage(maxRequestsValidationResult)

		if (!apiValidationResult && !maxRequestsValidationResult) {
			vscode.postMessage({ type: "apiConfiguration", apiConfiguration })
			vscode.postMessage({ type: "maxRequestsPerTask", text: maxRequestsPerTaskString })
			vscode.postMessage({ type: "customInstructions", text: customInstructions })
			vscode.postMessage({ type: "alwaysAllowReadOnly", bool: alwaysAllowReadOnly })
			vscode.postMessage({ type: "automaticallyRunTasks", bool: automaticallyRunTasks })
			onDone()
		}
	}

	useEffect(() => {
		setApiErrorMessage(undefined)
	}, [apiConfiguration])

	useEffect(() => {
		setMaxRequestsErrorMessage(undefined)
	}, [maxRequestsPerTask])

	const handleResetState = () => {
		vscode.postMessage({ type: "resetState" })
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
					<ApiOptions showModelOptions={true} apiErrorMessage={apiErrorMessage} />
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
						checked={automaticallyRunTasks}
						onChange={(e: any) => setAutomaticallyRunTasks(e.target.checked)}>
						<span style={{ fontWeight: "500" }}>Automatically run tasks</span>
					</VSCodeCheckbox>
					<p
						style={{
							fontSize: "12px",
							marginTop: "5px",
							color: "var(--vscode-descriptionForeground)",
						}}>
						When enabled, Claude will automatically execute tasks without requiring confirmation for each step.
					</p>
				</div>

				<div style={{ marginBottom: 5 }}>
					<VSCodeTextArea
						value={customInstructions ?? ""}
						style={{ width: "100%" }}
						rows={4}
						placeholder={
							'e.g. "Run unit tests at the end", "Use TypeScript with async/await", "Speak in Spanish"'
						}
						onInput={(e: any) => setCustomInstructions(e.target?.value ?? "")}>
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
						value={maxRequestsPerTaskString}
						style={{ width: "100%" }}
						placeholder="20"
						onInput={(e: any) => setMaxRequestsPerTaskString(e.target?.value ?? "")}>
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
