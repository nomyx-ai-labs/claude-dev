import { ClaudeDev } from "../ClaudeDev"

export function _calculateApiCost(
    self: ClaudeDev,
    inputTokens: number,
    outputTokens: number,
    cacheCreationInputTokens?: number,
    cacheReadInputTokens?: number
): number {
    const modelCacheWritesPrice = self.api.getModel().info.cacheWritesPrice
    let cacheWritesCost = 0
    if (cacheCreationInputTokens && modelCacheWritesPrice) {
        cacheWritesCost = (modelCacheWritesPrice / 1_000_000) * cacheCreationInputTokens
    }
    const modelCacheReadsPrice = self.api.getModel().info.cacheReadsPrice
    let cacheReadsCost = 0
    if (cacheReadInputTokens && modelCacheReadsPrice) {
        cacheReadsCost = (modelCacheReadsPrice / 1_000_000) * cacheReadInputTokens
    }
    const baseInputCost = (self.api.getModel().info.inputPrice / 1_000_000) * inputTokens
    const outputCost = (self.api.getModel().info.outputPrice / 1_000_000) * outputTokens
    const totalCost = cacheWritesCost + cacheReadsCost + baseInputCost + outputCost
    return totalCost
}
