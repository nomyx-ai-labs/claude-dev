import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaudeDev } from '../ClaudeDev';
import { ClaudeMessage } from '../shared/ExtensionMessage';
import { ensureTaskDirectoryExists } from './fileOperations';
import { getApiMetrics } from '../shared/getApiMetrics';
import { combineApiRequests } from '../shared/combineApiRequests';
import { combineCommandSequences } from '../shared/combineCommandSequences';

export async function getSavedClaudeMessages(claudeDev: ClaudeDev): Promise<ClaudeMessage[]> {
    const filePath = path.join(await ensureTaskDirectoryExists(claudeDev), "claude_messages.json");
    const fileExists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false);
    if (fileExists) {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }
    return [];
}

export async function addToClaudeMessages(claudeDev: ClaudeDev, message: ClaudeMessage) {
    claudeDev.claudeMessages.push(message);
    await saveClaudeMessages(claudeDev);
}

export async function overwriteClaudeMessages(claudeDev: ClaudeDev, newMessages: ClaudeMessage[]) {
    claudeDev.claudeMessages = newMessages;
    await saveClaudeMessages(claudeDev);
}

export async function saveClaudeMessages(claudeDev: ClaudeDev) {
    try {
        const filePath = path.join(await ensureTaskDirectoryExists(claudeDev), "claude_messages.json");
        await fs.writeFile(filePath, JSON.stringify(claudeDev.claudeMessages));
        // combined as they are in ChatView
        const apiMetrics = getApiMetrics(combineApiRequests(combineCommandSequences(claudeDev.claudeMessages.slice(1))));
        const taskMessage = claudeDev.claudeMessages[0]; // first message is always the task say
        await claudeDev.providerRef.deref()?.updateTaskHistory({
            id: claudeDev.taskId,
            ts: taskMessage.ts,
            task: taskMessage.text ?? "",
            tokensIn: apiMetrics.totalTokensIn,
            tokensOut: apiMetrics.totalTokensOut,
            cacheWrites: apiMetrics.totalCacheWrites,
            cacheReads: apiMetrics.totalCacheReads,
            totalCost: apiMetrics.totalCost,
        });
    } catch (error) {
        console.error("Failed to save claude messages:", error);
    }
}