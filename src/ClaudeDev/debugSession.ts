import * as vscode from 'vscode';
import { debuggerController } from '../debugger/debuggerController';

export async function startDebugging(config: vscode.DebugConfiguration): Promise<boolean> {
    return await debuggerController.startDebugging(config);
}

export async function stopDebugging(): Promise<void> {
    return await debuggerController.stopDebugging();
}

export function pauseDebugging(): void {
    debuggerController.pauseDebugging();
}

export async function continueDebugging(): Promise<void> {
    const session = vscode.debug.activeDebugSession;
    if (session) {
        await session.customRequest('continue');
    }
}

export async function stepOver(): Promise<void> {
    const session = vscode.debug.activeDebugSession;
    if (session) {
        await session.customRequest('next');
    }
}

export async function stepInto(): Promise<void> {
    const session = vscode.debug.activeDebugSession;
    if (session) {
        await session.customRequest('stepIn');
    }
}

export async function stepOut(): Promise<void> {
    const session = vscode.debug.activeDebugSession;
    if (session) {
        await session.customRequest('stepOut');
    }
}

export function isDebugging(): boolean {
    return vscode.debug.activeDebugSession !== undefined;
}

export function getActiveDebugSession(): vscode.DebugSession | undefined {
    return vscode.debug.activeDebugSession;
}