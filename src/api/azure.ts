import axios from "axios";
import { ApiHandler, ApiHandlerMessageResponse } from ".";
import { ApiHandlerOptions, azureDefaultModelId, AzureModelId, azureModels, ModelInfo } from "../shared/api";
import { Tool } from "../shared/Tool";

interface OpenAIToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: OpenAIToolCall[];
}

interface OpenAIResponse {
  choices: {
    message: OpenAIMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

interface ClaudeToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface ClaudeMessage {
  content: string | null;
  role: string;
  tool_calls?: ClaudeToolCall[];
}

interface ClaudeResponse {
  content: { type: string; text: string}[];
  role: string;
  tool_calls?: ClaudeToolCall[];
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

function convertOpenAIToClaudeFormat(openAIResponse: OpenAIResponse): ClaudeResponse {
  const openAIMessage = openAIResponse.choices[0].message;
  
  const claudeResponse: ClaudeResponse = {
    content: [{ type: 'text', text: openAIMessage.content || 'Calling functions...' }],
    role: openAIMessage.role,
    usage: {
      input_tokens: openAIResponse.usage.prompt_tokens || 0,
      output_tokens: openAIResponse.usage.completion_tokens || 0,
    }
  };

  if (openAIMessage.tool_calls) {
    openAIMessage.tool_calls.forEach(toolCall => {
      claudeResponse.content.push({
        id: toolCall.id,
        type: 'tool_use',
        name: toolCall.function.name,
        input: toolCall.function.arguments
      } as any);
  });
  }

  return claudeResponse;
}

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

interface ClaudeTool {  
  name: string;  
  description: string;  
  input_schema: {  
      properties: {  
          [key: string]: {  
              type: string;  
              description: string;  
          };  
      };  
      required: string[];  
  };  
}  

interface OpenAITool {  
  type: string;  
  function: {  
      name: string;  
      description: string;  
      parameters: {  
          type: string;  
          properties: {  
              [key: string]: {  
                  type: string;  
                  description: string;  
              };  
          };  
          required: string[];  
      };  
  };  
}  


class AzureOpenAI {
	private deploymentId: string;
	private endpoint: string;
	private apiKey: string;
  private tools: Tool[];
  private baseUrl: string;

	constructor(options: { baseUrl?: string, deploymentId: string; endpoint: string; azureApiKey: string, tools?: Tool[] }) {
		this.deploymentId = options.deploymentId;
		this.endpoint = options.endpoint;
		this.apiKey = options.azureApiKey;
    this.tools = options.tools || [];
    this.baseUrl = options.baseUrl || 'openai.azure.com';
	}

	async chat(params: ChatParams): Promise<any> {
    const url = `https://${this.endpoint}.${this.baseUrl}/openai/deployments/${this.deploymentId}/chat/completions?api-version=2023-03-15-preview`
    // check if tools are present and add them to the request
    if (this.tools.length > 0) {
      params.tools = this.tools;
      params.tool_choice = "auto";
    }
    console.log('calling', url, 'with', JSON.stringify(params));
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
      baseUrl: 'openai.azure.com',
      deploymentId: this.options.azureOpenAIDeployment || 'default',
      endpoint: this.options.azureEndpoint || '',
      azureApiKey: this.options.azureApiKey || '',
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

    const req = {
      messages: formattedMessages,
      temperature: 0.01,
      top_p: 0.95,
      max_tokens: 3500,
      tools: this.convertClaudeToOpenAI(tools),
      tool_choice: "auto"
    } as any;

    let response = await this.client.chat(req);
    response = convertOpenAIToClaudeFormat(response);

    return { message: response };
  }

  convertClaudeToOpenAI(claudeTools: ClaudeTool[]): OpenAITool[] {  
    return claudeTools.map(tool => ({  
      type: "function",  
      function: {  
        name: tool.name,  
        description: tool.description,  
        parameters: {  
          type: "object",  
          properties: tool.input_schema.properties,  
          required: tool.input_schema.required  
        }  
      }  
    }));  
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
      tool_choice: 'auto'
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