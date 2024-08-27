import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaudeDev } from '../ClaudeDev';

export async function ensureTaskDirectoryExists(claudeDev: ClaudeDev): Promise<string> {
    const globalStoragePath = claudeDev.providerRef.deref()?.context.globalStorageUri.fsPath;
    if (!globalStoragePath) {
        throw new Error("Global storage uri is invalid");
    }
    const taskDir = path.join(globalStoragePath, "tasks", claudeDev.taskId);
    await fs.mkdir(taskDir, { recursive: true });
    return taskDir;
}

export async function saveSettings(claudeDev: ClaudeDev) {
    const globalStoragePath = claudeDev.providerRef.deref()?.context.globalStorageUri.fsPath;
    if (!globalStoragePath) {
        throw new Error("Global storage uri is invalid");
    }
    const settingsPath = path.join(globalStoragePath, "settings.json");
    const settings = {
        requireManualConfirmation: claudeDev.requireManualConfirmation,
        autoStartTask: claudeDev.autoStartTask,
    };
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}

export async function loadSettings(claudeDev: ClaudeDev) {
    const globalStoragePath = claudeDev.providerRef.deref()?.context.globalStorageUri.fsPath;
    if (!globalStoragePath) {
        throw new Error("Global storage uri is invalid");
    }
    const settingsPath = path.join(globalStoragePath, "settings.json");
    try {
        const settingsContent = await fs.readFile(settingsPath, "utf-8");
        const settings = JSON.parse(settingsContent);
        claudeDev.requireManualConfirmation = settings.requireManualConfirmation ?? false;
        claudeDev.autoStartTask = settings.autoStartTask ?? true;
    } catch (error) {
        console.error("Failed to load settings:", error);
        claudeDev.requireManualConfirmation = false;
        claudeDev.autoStartTask = true;
        await saveSettings(claudeDev);
    }
}