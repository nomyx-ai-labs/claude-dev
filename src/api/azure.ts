import axios from "axios";
import { ApiHandler, ApiHandlerMessageResponse } from ".";
import { ApiHandlerOptions, azureDefaultModelId, AzureModelId, azureModels, ModelInfo } from "../shared/api";
import { Tool } from "../shared/Tool";

interface ChatParams {
	messages: Array<{
		role: string;
		content: Array<{ type: string; text: string }>;
	}>;
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
  tools?: Tool[];
  tool_choice?: any;
}

class AzureOpenAI {
	private deploymentId: string;
	private endpoint: string;
	private apiKey: string;
  private tools: Tool[];

	constructor(options: { deploymentId: string; endpoint: string; apiKey: string, tools?: Tool[] }) {
		this.deploymentId = options.deploymentId;
		this.endpoint = options.endpoint;
		this.apiKey = options.apiKey;
    this.tools = options.tools || [];
	}

	async chat(params: ChatParams): Promise<any> {
		const url = `${this.endpoint}/openai/deployments/${this.deploymentId}/chat/completions?api-version=2024-02-15-preview`;
    // check if tools are present and add them to the request
    if (this.tools.length > 0) {
      params.tools = this.tools;
      params.tool_choice = { type: "auto" };
    }
		const response = await axios.post(url, params, {
			headers: {
				"Content-Type": "application/json",
				"api-key": this.apiKey,
			},
		});

		return response.data;
	}
}

export class AzureHandler implements ApiHandler {
  private options: ApiHandlerOptions;
  private client: AzureOpenAI;

  constructor(options: ApiHandlerOptions) {
    this.options = options;
    this.client = new AzureOpenAI({
      deploymentId: this.options.azureDeploymentId || 'default',
      endpoint: this.options.azureEndpoint || 'https://api.cognitive.microsoft.com',
      apiKey: this.options.apiKey || '',
    });
  }

  async createMessage(
    systemPrompt: string,
    messages: Array<{ role: string; content: any }>,
    tools: any[]
  ): Promise<ApiHandlerMessageResponse> {
    const formattedMessages = [
      { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
      ...messages.map(msg => ({
        role: msg.role,
        content: Array.isArray(msg.content) 
          ? msg.content 
          : [{ type: 'text', text: msg.content }]
      }))
    ];

    const response = await this.client.chat({
      messages: formattedMessages,
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: this.getModel().info.maxTokens,
      tools,
      tool_choice: { type: "auto" }
    });

    return { message: response.choices[0].message };
  }

  createUserReadableRequest(
    userContent: Array<any>
  ): any {
    return {
      messages: [
        { role: 'system', content: [{ type: 'text', text: "(see tools in src/shared/prompt.ts))" }] },
        { role: 'user', content: this.withoutImageData(userContent) }
      ],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: this.getModel().info.maxTokens,
      tools: "(see tools in src/ClaudeDev/tools/getTools.ts)",
      tool_choice: { type: "auto" }
    };
  }

  getModel(): { id: any; info: ModelInfo } {
    const modelId = this.options.apiModelId as AzureModelId;
    if (modelId && modelId in azureModels) {
      return { id: modelId, info: azureModels[modelId] };
    }
    return { id: azureDefaultModelId, info: azureModels[azureDefaultModelId] };
  }

  private withoutImageData(content: Array<any>): Array<any> {
    return content.map(item => {
      if (item.type === 'image') {
        return { ...item, url: 'Image URL removed' };
      }
      return item;
    });
  }
}