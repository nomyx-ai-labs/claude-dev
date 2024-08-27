import * as vscode from 'vscode';
import { Prompt } from '../shared/Prompt';
import { ApiHandler } from './index';
import { Anthropic } from '@anthropic-ai/sdk';

export class StructuredPromptManager {
  private apiHandler: ApiHandler;

  constructor(apiHandler: ApiHandler) {
    this.apiHandler = apiHandler;
  }

  async getPrompts(): Promise<Prompt[]> {
    const prompts = await vscode.workspace.getConfiguration().get<Prompt[]>('claudedev.structuredPrompts', []);
    return prompts;
  }

  async getPrompt(name: string): Promise<Prompt | undefined> {
    const prompts = await this.getPrompts();
    return prompts.find(prompt => prompt.name === name);
  }

  async addPrompt(prompt: Prompt): Promise<void> {
    const prompts = await this.getPrompts();
    prompts.push(prompt);
    await vscode.workspace.getConfiguration().update('claudedev.structuredPrompts', prompts, vscode.ConfigurationTarget.Global);
  }

  async editPrompt(name: string, updatedPrompt: Prompt): Promise<void> {
    const prompts = await this.getPrompts();
    const index = prompts.findIndex(prompt => prompt.name === name);
    if (index !== -1) {
      prompts[index] = updatedPrompt;
      await vscode.workspace.getConfiguration().update('claudedev.structuredPrompts', prompts, vscode.ConfigurationTarget.Global);
    }
  }

  async deletePrompt(name: string): Promise<void> {
    const prompts = await this.getPrompts();
    const filteredPrompts = prompts.filter(prompt => prompt.name !== name);
    await vscode.workspace.getConfiguration().update('claudedev.structuredPrompts', filteredPrompts, vscode.ConfigurationTarget.Global);
  }

  async filterPrompts(category: string, tags: string[]): Promise<Prompt[]> {
    const prompts = await this.getPrompts();
    return prompts.filter(prompt => 
      prompt.category === category && 
      prompt.tags !== undefined &&
      tags.every(tag => prompt.tags!.includes(tag))
    );
  }

  async searchPrompts(query: string): Promise<Prompt[]> {
    const prompts = await this.getPrompts();
    const lowerQuery = query.toLowerCase();
    return prompts.filter(prompt => 
      prompt.name.toLowerCase().includes(lowerQuery) ||
      prompt.description.toLowerCase().includes(lowerQuery)
    );
  }

  makePromptFunction(name: string): (request: any, state?: any) => Promise<string> {
    return async (request: any, state?: any) => {
      const prompt = await this.getPrompt(name);
      if (!prompt) {
        throw new Error(`Prompt with name ${name} not found`);
      }

      let systemPrompt = prompt.system || '';
      let userPrompt = prompt.user || '';

      // Replace placeholders in system and user prompts
      for (const [key, value] of Object.entries(request)) {
        systemPrompt = systemPrompt.replace(`{${key}}`, value as string);
        userPrompt = userPrompt.replace(`{${key}}`, value as string);
      }

      const fullPrompt = `system: ${systemPrompt}. You must return all responses using JSON with the following format: ${prompt.response}\nuser: ${userPrompt}\nSession state: ${JSON.stringify(state || {})}`;

      // Use the APIHandler to make the actual API call
      const response = await this.apiHandler.createMessage(
        systemPrompt!,
        [{ role: 'user', content: userPrompt }],
        []
      );

      const content = response.message.content[0];
      if ('text' in content) {
        return content.text;
      } else {
        throw new Error('Unexpected response format');
      }
    };
  }
}