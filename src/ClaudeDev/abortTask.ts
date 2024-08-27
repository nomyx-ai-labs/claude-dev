import treeKill from "tree-kill";
import { ClaudeDev } from "../ClaudeDev";

export function abortTask(this: ClaudeDev) {
    this.abort = true;
    const runningProcessId = this.executeCommandRunningProcess?.pid;
    if (runningProcessId) {
        treeKill(runningProcessId, "SIGTERM");
    }
}