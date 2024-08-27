import * as vscode from 'vscode';
import { DebugProtocol } from '@vscode/debugprotocol';
import { debuggerController } from '../debugger/debuggerController';

export async function getCallStack(session: vscode.DebugSession): Promise<DebugProtocol.StackFrame[]> {
    return await debuggerController.getCallStack(session);
}

export async function getVariables(session: vscode.DebugSession, frameId: number): Promise<DebugProtocol.Variable[]> {
    return await debuggerController.getVariables(session, frameId);
}

export async function evaluateExpression(session: vscode.DebugSession, expression: string, frameId?: number): Promise<string> {
    return await debuggerController.evaluateExpression(session, expression, frameId);
}

export async function setVariable(session: vscode.DebugSession, variableReference: number, name: string, value: string): Promise<void> {
    await debuggerController.setVariable(session, variableReference, name, value);
}

export async function getOutput(session: vscode.DebugSession): Promise<string> {
    return await debuggerController.getOutput(session);
}

export async function sendInput(session: vscode.DebugSession, input: string): Promise<void> {
    await debuggerController.sendInput(session, input);
}