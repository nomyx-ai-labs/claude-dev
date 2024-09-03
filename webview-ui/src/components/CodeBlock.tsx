import React, { useMemo, useState, useEffect } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { getLanguageFromPath } from "../utils/getLanguageFromPath"
import { SyntaxHighlighterStyle } from "../utils/getSyntaxHighlighterStyleFromTheme"

/*
const vscodeSyntaxStyle: React.CSSProperties = {
	backgroundColor: "var(--vscode-editor-background)",
	color: "var(--vscode-editor-foreground)",
	fontFamily: "var(--vscode-editor-font-family)",
	fontSize: "var(--vscode-editor-font-size)",
	lineHeight: "var(--vscode-editor-line-height)",
	textAlign: "left",
	whiteSpace: "pre",
	wordSpacing: "normal",
	wordBreak: "normal",
	wordWrap: "normal",
	tabSize: 4,
	hyphens: "none",
	padding: "1em",
	margin: "0.5em 0",
	overflow: "auto",
	borderRadius: "6px",
}

const tokenStyles = {
	comment: { color: "var(--vscode-editor-foreground)" },
	prolog: { color: "var(--vscode-editor-foreground)" },
	doctype: { color: "var(--vscode-editor-foreground)" },
	cdata: { color: "var(--vscode-editor-foreground)" },
	punctuation: { color: "var(--vscode-editor-foreground)" },
	property: { color: "var(--vscode-symbolIcon-propertyForeground)" },
	tag: { color: "var(--vscode-symbolIcon-colorForeground)" },
	boolean: { color: "var(--vscode-symbolIcon-booleanForeground)" },
	number: { color: "var(--vscode-symbolIcon-numberForeground)" },
	constant: { color: "var(--vscode-symbolIcon-constantForeground)" },
	symbol: { color: "var(--vscode-symbolIcon-colorForeground)" },
	selector: { color: "var(--vscode-symbolIcon-colorForeground)" },
	"attr-name": { color: "var(--vscode-symbolIcon-propertyForeground)" },
	string: { color: "var(--vscode-symbolIcon-stringForeground)" },
	char: { color: "var(--vscode-symbolIcon-stringForeground)" },
	builtin: { color: "var(--vscode-symbolIcon-keywordForeground)" },
	inserted: { color: "var(--vscode-gitDecoration-addedResourceForeground)" },
	operator: { color: "var(--vscode-symbolIcon-operatorForeground)" },
	entity: { color: "var(--vscode-symbolIcon-snippetForeground)", cursor: "help" },
	url: { color: "var(--vscode-textLink-foreground)" },
	variable: { color: "var(--vscode-symbolIcon-variableForeground)" },
	atrule: { color: "var(--vscode-symbolIcon-keywordForeground)" },
	"attr-value": { color: "var(--vscode-symbolIcon-stringForeground)" },
	keyword: { color: "var(--vscode-symbolIcon-keywordForeground)" },
	function: { color: "var(--vscode-symbolIcon-functionForeground)" },
	regex: { color: "var(--vscode-symbolIcon-regexForeground)" },
	important: { color: "var(--vscode-editorWarning-foreground)", fontWeight: "bold" },
	bold: { fontWeight: "bold" },
	italic: { fontStyle: "italic" },
	deleted: { color: "var(--vscode-gitDecoration-deletedResourceForeground)" },
}
*/


interface CodeBlockProps {
	code?: string
	diff?: string
	language?: string | undefined
	path?: string
	syntaxHighlighterStyle: SyntaxHighlighterStyle
	isExpanded: boolean
	onToggleExpand: () => void
	onApprove?: () => void
}

const CodeBlock = ({
	code,
	diff,
	language,
	path,
	syntaxHighlighterStyle,
	isExpanded,
	onToggleExpand,
	onApprove,
}: CodeBlockProps) => {
	const [isApproved, setIsApproved] = useState(false);
	const [countdown, setCountdown] = useState(3);

	const removeLeadingNonAlphanumeric = (path: string): string => path.replace(/^[^a-zA-Z0-9]+/, "")

	const inferredLanguage = useMemo(
		() => code && (language ?? (path ? getLanguageFromPath(path) : undefined)),
		[path, language, code]
	)

	useEffect(() => {
		if (diff && !isApproved) {
			const timer = setInterval(() => {
				setCountdown((prevCountdown) => {
					if (prevCountdown === 1) {
						clearInterval(timer);
						setIsApproved(true);
						onApprove && onApprove();
						return 0;
					}
					return prevCountdown - 1;
				});
			}, 1000);

			return () => clearInterval(timer);
		}
	}, [diff, isApproved, onApprove]);

	return (
		<div
			style={{
				borderRadius: "3px",
				backgroundColor: "var(--vscode-editor-background)",
				overflow: "hidden",
				border: "1px solid var(--vscode-editorGroup-border)",
			}}>
			{path && (
				<div
					style={{
						color: "var(--vscode-descriptionForeground)",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						padding: "6px 10px",
						cursor: "pointer",
					}}
					onClick={onToggleExpand}>
					<span
						style={{
							whiteSpace: "nowrap",
							overflow: "hidden",
							textOverflow: "ellipsis",
							marginRight: "8px",
							fontSize: "11px",
							direction: "rtl",
							textAlign: "left",
						}}>
						{removeLeadingNonAlphanumeric(path) + "\u200E"}
					</span>
					<span className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}></span>
				</div>
			)}
			{(!path || isExpanded) && (
				<>
					{diff && (
						<div style={{ padding: "6px 10px", backgroundColor: "var(--vscode-editorInfo-background)", color: "var(--vscode-editorInfo-foreground)" }}>
							{isApproved ? "Changes automatically approved" : `Approving changes in ${countdown} seconds...`}
						</div>
					)}
					<div
						style={{
							overflowX: "auto",
							overflowY: "hidden",
							maxWidth: "100%",
						}}>
						<SyntaxHighlighter
							wrapLines={false}
							language={diff ? "diff" : inferredLanguage}
							style={{
								...syntaxHighlighterStyle,
								'code[class*="language-"]': {
									background: "var(--vscode-editor-background)",
								},
								'pre[class*="language-"]': {
									background: "var(--vscode-editor-background)",
								},
							}}
							customStyle={{
								margin: 0,
								padding: "6px 10px",
								minWidth: "max-content",
								borderRadius: 0,
								fontSize: "var(--vscode-editor-font-size)",
								lineHeight: "var(--vscode-editor-line-height)",
								fontFamily: "var(--vscode-editor-font-family)",
							}}>
							{code ?? diff ?? ""}
						</SyntaxHighlighter>
					</div>
				</>
			)}
		</div>
	)
}

export default CodeBlock
