import * as path from "path"

export function formatFilesList(absolutePath: string, files: string[]): string {
    const sorted = files
        .map((file) => {
            const relativePath = path.relative(absolutePath, file)
            return file.endsWith("/") ? relativePath + "/" : relativePath
        })
        .sort((a, b) => {
            const aIsDir = a.endsWith("/")
            const bIsDir = b.endsWith("/")
            if (aIsDir !== bIsDir) {
                return aIsDir ? -1 : 1
            }
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        })

    if (sorted.length > 1000) {
        const truncatedList = sorted.slice(0, 1000).join("\n")
        const remainingCount = sorted.length - 1000
        return `${truncatedList}\n\n(${remainingCount} files not listed due to automatic truncation. Try listing files in subdirectories if you need to explore further.)`
    } else if (sorted.length === 0 || (sorted.length === 1 && sorted[0] === "")) {
        return "No files found or you do not have permission to view this directory."
    } else {
        return sorted.join("\n")
    }
}