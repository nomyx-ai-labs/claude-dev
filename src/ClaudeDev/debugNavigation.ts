import * as vscode from 'vscode';
import { debuggerController } from '../debugger/debuggerController';

export function addBreakpoint(location: vscode.Location): vscode.Breakpoint {
    return debuggerController.addBreakpoint(location);
}

export function removeBreakpoint(breakpoint: vscode.Breakpoint): void {
    debuggerController.removeBreakpoint(breakpoint);
}

export function getBreakpoints(): readonly vscode.Breakpoint[] {
    return debuggerController.getBreakpoints();
}

export async function openFile(filePath: string, line: number, column: number): Promise<void> {
    await debuggerController.openFile(filePath, line, column);
}

export async function getSourceCode(filePath: string): Promise<string> {
    return await debuggerController.getSourceCode(filePath);
}

export function getCurrentFilePath(): string | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    return activeEditor?.document.uri.fsPath;
}

export function getCurrentLine(): number | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    return activeEditor?.selection.active.line;
}

export function getCurrentColumn(): number | undefined {
    const activeEditor = vscode.window.activeTextEditor;
    return activeEditor?.selection.active.character;
}