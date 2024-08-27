import * as fs from 'fs/promises';
import * as path from 'path';
import { Anthropic } from "@anthropic-ai/sdk";
import { ClaudeDev } from '../ClaudeDev';
import { ensureTaskDirectoryExists } from './fileOperations';

export async function getSavedApiConversationHistory(claudeDev: ClaudeDev): Promise<Anthropic.MessageParam[]> {
    const filePath = path.join(await ensureTaskDirectoryExists(claudeDev), "api_conversation_history.json");
    const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
    if (fileExists) {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }
    return [];
}

export async function addToApiConversationHistory(claudeDev: ClaudeDev, message: Anthropic.MessageParam) {
    claudeDev.apiConversationHistory.push(message);
    await saveApiConversationHistory(claudeDev);
}

export async function overwriteApiConversationHistory(claudeDev: ClaudeDev, newHistory: Anthropic.MessageParam[]) {
    claudeDev.apiConversationHistory = newHistory;
    await saveApiConversationHistory(claudeDev);
}

export async function saveApiConversationHistory(claudeDev: ClaudeDev) {
    try {
        const filePath = path.join(await ensureTaskDirectoryExists(claudeDev), "api_conversation_history.json");
        await fs.writeFile(filePath, JSON.stringify(claudeDev.apiConversationHistory));
    } catch (error) {
        // in the off chance this fails, we don't want to stop the task
        console.error("Failed to save API conversation history:", error);
    }
}