import { ClaudeAsk } from "../shared/ExtensionMessage";
import { addToClaudeMessages } from "./claudeMessages";
import pWaitFor from "p-wait-for";
import { ClaudeDev } from "../ClaudeDev";
import { ClaudeAskResponse } from "../shared/WebviewMessage";

export async function ask(
    this: ClaudeDev,
    type: ClaudeAsk,
    question?: string
): Promise<{ response: ClaudeAskResponse; text?: string; images?: string[] }> {
    if (this.abort) {
        throw new Error("ClaudeDev instance aborted");
    }
    this.askResponse = undefined;
    this.askResponseText = undefined;
    this.askResponseImages = undefined;
    const askTs = Date.now();
    this.lastMessageTs = askTs;
    await addToClaudeMessages(this, { ts: askTs, type: "ask", ask: type, text: question });
    await this.providerRef.deref()?.postStateToWebview();

    if (!this.requireManualConfirmation) {
        this.askResponse = "yesButtonTapped";
        this.askResponseText = "";
        this.askResponseImages = [];
    } else {
        await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 });
        if (this.lastMessageTs !== askTs) {
            throw new Error("Current ask promise was ignored");
        }
    }
    await pWaitFor(() => this.askResponse !== undefined || this.lastMessageTs !== askTs, { interval: 100 });
    if (this.lastMessageTs !== askTs) {
        throw new Error("Current ask promise was ignored");
    }

    const result = { response: this.askResponse!, text: this.askResponseText, images: this.askResponseImages };
    this.askResponse = undefined;
    this.askResponseText = undefined;
    this.askResponseImages = undefined;
    return result;
}