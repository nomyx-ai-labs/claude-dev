import { ClaudeSay } from "../shared/ExtensionMessage";
import { addToClaudeMessages } from "./claudeMessages";
import { ClaudeDev } from "../ClaudeDev";

export async function say(this: ClaudeDev, type: ClaudeSay, text?: string, images?: string[]): Promise<undefined> {
    if (this.abort) {
        throw new Error("ClaudeDev instance aborted");
    }
    const sayTs = Date.now();
    this.lastMessageTs = sayTs;
    await addToClaudeMessages(this, { ts: sayTs, type: "say", say: type, text: text, images });
    await this.providerRef.deref()?.postStateToWebview();
}