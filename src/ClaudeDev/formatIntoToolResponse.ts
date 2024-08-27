import { Anthropic } from "@anthropic-ai/sdk"
import { ToolResponse } from "./types"
import { formatImagesIntoBlocks } from "./formatImagesIntoBlocks"

export function formatIntoToolResponse(text: string, images?: string[]): ToolResponse {
    if (images && images.length > 0) {
        const textBlock: Anthropic.TextBlockParam = { type: "text", text }
        const imageBlocks: Anthropic.ImageBlockParam[] = formatImagesIntoBlocks(images)
        return [textBlock, ...imageBlocks]
    } else {
        return text
    }
}