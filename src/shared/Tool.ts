import { Anthropic } from "@anthropic-ai/sdk"

export type ToolName =
	| "write_to_file"
	| "read_file"
	| "list_files"
	| "list_code_definition_names"
	| "search_files"
	| "execute_command"
	| "ask_followup_question"
	| "attempt_completion"
	| "get_problems_list"
	| "get_debug_console"
	| "get_terminal"
	| "get_editor"
	| "start_debugging"
	| "stop_debugging"
	| "pause_debugging"
	| "resume_debugging"
	| "step_over"
	| "step_into"
	| "step_out"
	| "get_call_stack"
	| "get_variables"
	| "get_breakpoints"
	| "add_breakpoint"
	| "remove_breakpoint"
	| "evaluate_expression"
	| "search_google"
	| "get_page_content"



export type Tool = Omit<Anthropic.Tool, "name"> & {
	name: ToolName
}
