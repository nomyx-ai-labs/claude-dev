import { ApiModelId, ApiProvider } from "../../shared/api"
import { HistoryItem } from "../../shared/HistoryItem"
import { ClaudeDevProvider } from "../ClaudeDevProvider"

export async function getState(self: ClaudeDevProvider) {
    const [
        storedApiProvider,
        apiModelId,
        apiKey,
        openRouterApiKey,
        awsAccessKey,
        awsSecretKey,
        awsRegion,
        koduApiKey,
        koduEmail,
        koduCredits,
        maxRequestsPerTask,
        lastShownAnnouncementId,
        customInstructions,
        alwaysAllowReadOnly,
        taskHistory,
        shouldShowKoduPromo,
        requireManualConfirmation,
        autoStartTask,
        gcProjectId,
        gcRegion,
        gcServiceAccountKey,
    ] = await Promise.all([
        self.getGlobalState("apiProvider") as Promise<ApiProvider | undefined>,
        self.getGlobalState("apiModelId") as Promise<ApiModelId | undefined>,
        self.getSecret("apiKey") as Promise<string | undefined>,
        self.getSecret("openRouterApiKey") as Promise<string | undefined>,
        self.getSecret("awsAccessKey") as Promise<string | undefined>,
        self.getSecret("awsSecretKey") as Promise<string | undefined>,
        self.getGlobalState("awsRegion") as Promise<string | undefined>,
        self.getSecret("koduApiKey") as Promise<string | undefined>,
        self.getGlobalState("koduEmail") as Promise<string | undefined>,
        self.getGlobalState("koduCredits") as Promise<number | undefined>,
        self.getGlobalState("maxRequestsPerTask") as Promise<number | undefined>,
        self.getGlobalState("lastShownAnnouncementId") as Promise<string | undefined>,
        self.getGlobalState("customInstructions") as Promise<string | undefined>,
        self.getGlobalState("alwaysAllowReadOnly") as Promise<boolean | undefined>,
        self.getGlobalState("taskHistory") as Promise<HistoryItem[] | undefined>,
        self.getGlobalState("shouldShowKoduPromo") as Promise<boolean | undefined>,
        self.getGlobalState("requireManualConfirmation") as Promise<boolean | undefined>,
        self.getGlobalState("autoStartTask") as Promise<boolean | undefined>,
        self.getGlobalState("gcProjectId") as Promise<string | undefined>,
        self.getGlobalState("gcRegion") as Promise<string | undefined>,
        self.getSecret("gcServiceAccountKey") as Promise<string | undefined>,
    ])

    let apiProvider: ApiProvider
    if (storedApiProvider) {
        apiProvider = storedApiProvider
    } else {
        // Either new user or legacy user that doesn't have the apiProvider stored in state
        // (If they're using OpenRouter or Bedrock, then apiProvider state will exist)
        if (apiKey) {
            apiProvider = "anthropic"
        } else {
            // New users should default to kodu
            apiProvider = "kodu"
        }
    }

    return {
        apiConfiguration: {
            apiProvider,
            apiModelId,
            apiKey,
            openRouterApiKey,
            awsAccessKey,
            awsSecretKey,
            awsRegion,
            koduApiKey,
            koduEmail,
        },
        maxRequestsPerTask,
        lastShownAnnouncementId,
        customInstructions,
        alwaysAllowReadOnly: alwaysAllowReadOnly ?? false,
        taskHistory,
        koduCredits,
        shouldShowKoduPromo: shouldShowKoduPromo ?? true,
        requireManualConfirmation: requireManualConfirmation ?? false,
        autoStartTask: autoStartTask ?? true,
    }
}
