import { ToolName } from "../shared/Tool";
import { ToolResponse } from "./types";
import { writeToFile } from "./writeToFile";
import { listFilesTopLevel } from "./listFilesTopLevel";
import { listFilesRecursive } from "./listFilesRecursive";
import { viewSourceCodeDefinitionsTopLevel } from "./viewSourceCodeDefinitionsTopLevel";
import { executeCommand } from "./executeCommand";
import { ClaudeDev } from "../ClaudeDev";

export async function executeTool(this: ClaudeDev, toolName: ToolName, toolInput: any, isLastWriteToFile: boolean = false): Promise<ToolResponse> {
    switch (toolName) {
        case "write_to_file":
            return writeToFile(this, toolInput.path, toolInput.content, isLastWriteToFile);
        case "read_file":
            return this.readFile(toolInput.path);
        case "list_files_top_level":
            return listFilesTopLevel(this, toolInput.path);
        case "list_files_recursive":
            return listFilesRecursive(this, toolInput.path);
        case "view_source_code_definitions_top_level":
            return viewSourceCodeDefinitionsTopLevel(this, toolInput.path);
        case "execute_command":
            return executeCommand(this, toolInput.command);
        case "ask_followup_question":
            return this.askFollowupQuestion(toolInput.question);
        case "attempt_completion":
            return this.attemptCompletion(toolInput.result, toolInput.command);
        default:
            return `Unknown tool: ${toolName}`;
    }
}