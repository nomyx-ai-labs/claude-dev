import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';

export class DebuggerController {
    constructor() {}

    // Debugger Control Tools
    async startDebugging(config: vscode.DebugConfiguration): Promise<boolean> {
        return vscode.debug.startDebugging(undefined, config);
    }

    stopDebugging(session?: vscode.DebugSession): Thenable<void> {
        return vscode.debug.stopDebugging(session);
    }

    pauseDebugging(): void {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            activeSession.customRequest('pause');
        }
    }

    resumeDebugging(): void {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            activeSession.customRequest('continue');
        }
    }

    // Breakpoint Management
    addBreakpoint(location: vscode.Location): vscode.Breakpoint {
        return new vscode.SourceBreakpoint(location);
    }

    removeBreakpoint(breakpoint: vscode.Breakpoint): void {
        vscode.debug.removeBreakpoints([breakpoint]);
    }

    getBreakpoints(): readonly vscode.Breakpoint[] {
        return vscode.debug.breakpoints;
    }

    stepOver(): void {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            activeSession.customRequest('next');
        }
    }

    stepInto(): void {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            activeSession.customRequest('stepIn');
        }
    }

    stepOut(): void {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            activeSession.customRequest('stepOut');
        }
    }

    getActiveCallStack(): Thenable<DebugProtocol.StackFrame[]> {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            return activeSession.customRequest('stackTrace', { threadId: 1 });
        }
        return Promise.resolve([]);
    }

    getActiveFrameId(): Thenable<number> {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            return activeSession.customRequest('stackTrace', { threadId: 1 }).then((result) => {
                return result.stackFrames[0].id;
            });
        }
        return Promise.resolve(-1);
    }

    getActiveFrameVariables(): Thenable<DebugProtocol.Variable[]> {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            return activeSession.customRequest('scopes', { frameId: 1 }).then((scopes) => {
                return activeSession.customRequest('variables', { variablesReference: scopes.scopes[0].variablesReference }).then((variables) => {
                    return variables.variables;
                });
            });
        }
        return Promise.resolve([]);
    }

    // State Inspection
    async getCallStack(session ?:vscode.DebugSession): Promise<DebugProtocol.StackFrame[]> {
        const activeSession = session || vscode.debug.activeDebugSession;
        if (!activeSession) {
            return [];
        }
        const result = await activeSession.customRequest('stackTrace', { threadId: 1 });
        return result.stackFrames;
    }

    async getVariables(frameId?: number, session ?: vscode.DebugSession): Promise<DebugProtocol.Variable[]> {
        const activeSession = session || vscode.debug.activeDebugSession;
        if (!activeSession) {
            return [];
        }
        const activeFrameId = frameId || await this.getActiveFrameId();
        const scopes = await activeSession.customRequest('scopes', { frameId: activeFrameId });
        const variables = await activeSession.customRequest('variables', { variablesReference: scopes.scopes[0].variablesReference });
        return variables.variables;
    }

    async evaluateExpression(expression: string, session?: vscode.DebugSession): Promise<string> {
        const frameId = await this.getActiveFrameId();
        const activeSession = session || vscode.debug.activeDebugSession;
        if (!activeSession) {
            return '';
        }
        const result = await activeSession.customRequest('evaluate', { expression, frameId });
        return result.result;
    }

    async evaluate(expression: string): Promise<string> {
        const activeSession = vscode.debug.activeDebugSession;
        if (activeSession) {
            const frameId = await this.getActiveFrameId();
            const result = await activeSession.customRequest('evaluate', { expression, frameId });
            return result.result;
        }
        return '';
    }

    // Application Interaction
    async sendInput(session: vscode.DebugSession, input: string): Promise<void> {
        await session.customRequest('stdin', { text: input });
    }

    async getOutput(session: vscode.DebugSession): Promise<string> {
        // This is a simplified version. In reality, you'd need to set up event listeners for debug console output
        const result = await session.customRequest('evaluate', { expression: 'console.log output' });
        return result.result;
    }

    async setVariable(session: vscode.DebugSession, variableReference: number, name: string, value: string): Promise<void> {
        await session.customRequest('setVariable', { variablesReference: variableReference, name, value });
    }

    // Source Code Navigation
    async openFile(filePath: string, line: number, column: number): Promise<void> {
        const document = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(document);
        const position = new vscode.Position(line - 1, column - 1);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position));
    }

    async getSourceCode(filePath: string): Promise<string> {
        const document = await vscode.workspace.openTextDocument(filePath);
        return document.getText();
    }

    getActiveDebugSession(): vscode.DebugSession | undefined {
        return vscode.debug.activeDebugSession;
    }
}

export const debuggerController = new DebuggerController();