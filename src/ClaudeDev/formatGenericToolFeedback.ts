import { getPotentiallyRelevantDetails } from "./getPotentiallyRelevantDetails"

export function formatGenericToolFeedback(feedback?: string): string {
    return `The user denied this operation and provided the following feedback:\n<feedback>\n${feedback}\n</feedback>\n\n${getPotentiallyRelevantDetails()}`
}