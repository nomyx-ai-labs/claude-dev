import { Anthropic } from "@anthropic-ai/sdk"

export function formatImagesIntoBlocks(images?: string[]): Anthropic.ImageBlockParam[] {
    return images
        ? images.map((dataUrl) => {
                const [rest, base64] = dataUrl.split(",")
                const mimeType = rest.split(":")[1].split(";")[0]
                return {
                    type: "image",
                    source: { type: "base64", media_type: mimeType, data: base64 },
                } as Anthropic.ImageBlockParam
          })
        : []
}