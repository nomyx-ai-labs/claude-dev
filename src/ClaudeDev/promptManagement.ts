import * as vscode from 'vscode';
import { StructuredPromptManager } from '../api/structuredPromptManager';
import { Prompt } from '../shared/Prompt';

export const listPrompts = async (promptManager: StructuredPromptManager): Promise<Prompt[]> => {
  return await promptManager.getPrompts();
};

export const searchPrompts = async (promptManager: StructuredPromptManager, query: string): Promise<Prompt[]> => {
  return await promptManager.searchPrompts(query);
};

export const callPrompt = async (promptManager: StructuredPromptManager, name: string, request: any, state?: any): Promise<string> => {
  const promptFunction = promptManager.makePromptFunction(name);
  return await promptFunction(request, state);
};

export const addPrompt = async (promptManager: StructuredPromptManager, prompt: Prompt): Promise<void> => {
  await promptManager.addPrompt(prompt);
};

export const editPrompt = async (promptManager: StructuredPromptManager, name: string, updatedPrompt: Prompt): Promise<void> => {
  await promptManager.editPrompt(name, updatedPrompt);
};

export const deletePrompt = async (promptManager: StructuredPromptManager, name: string): Promise<void> => {
  await promptManager.deletePrompt(name);
};

export const exportPrompts = async (promptManager: StructuredPromptManager): Promise<void> => {
  const prompts = await promptManager.getPrompts();
  const jsonContent = JSON.stringify(prompts, null, 2);
  
  const uri = await vscode.window.showSaveDialog({
    filters: { 'JSON': ['json'] },
    defaultUri: vscode.Uri.file('claude_dev_prompts.json')
  });

  if (uri) {
    await vscode.workspace.fs.writeFile(uri, new Uint8Array(Buffer.from(jsonContent, 'utf-8')));
    vscode.window.showInformationMessage('Prompts exported successfully.');
  }
};

export const importPrompts = async (promptManager: StructuredPromptManager): Promise<void> => {
  const uri = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: { 'JSON': ['json'] }
  });

  if (uri && uri[0]) {
    const content = await vscode.workspace.fs.readFile(uri[0]);
    const prompts: Prompt[] = JSON.parse(content.toString());
    
    for (const prompt of prompts) {
      await promptManager.addPrompt(prompt);
    }
    
    vscode.window.showInformationMessage('Prompts imported successfully.');
  }
};

export const getDebuggingCapabilitiesPrompt = (): string => {
  return `
As an AI assistant with debugging capabilities, you can now perform the following actions:

1. Debug Session Management:
   - Start a debugging session
   - Stop a debugging session
   - Pause/resume execution
   - Step over, into, and out of code

2. Breakpoint Management:
   - Add breakpoints to specific lines in files
   - Remove breakpoints
   - List all current breakpoints

3. State Inspection:
   - View the current call stack
   - Inspect variables in the current scope
   - Evaluate expressions in the current context

4. Code Navigation:
   - Open specific files at given line and column numbers
   - Retrieve source code content

5. Application Interaction:
   - Send input to the debugged application
   - Retrieve output from the debugged application

When debugging, consider the following best practices:
- Start by setting appropriate breakpoints in areas of interest
- Use step-by-step execution to carefully examine program flow
- Inspect variables and evaluate expressions to understand the program state
- Modify variables when necessary to test different scenarios
- Pay attention to the call stack to understand the execution path

Remember to use these capabilities judiciously and in conjunction with your programming knowledge to effectively diagnose and fix issues in the code.
  `;
};

export const updateAIPromptWithDebuggingCapabilities = async (promptManager: StructuredPromptManager): Promise<void> => {
  const debuggingCapabilitiesPrompt = getDebuggingCapabilitiesPrompt();
  const systemPrompt = await promptManager.getPrompt('system');
  
  if (systemPrompt) {
    const updatedPrompt: Prompt = {
      ...systemPrompt,
      text: `${systemPrompt.text}\n\n${debuggingCapabilitiesPrompt}`
    };
    await promptManager.editPrompt('system', updatedPrompt);
  } else {
    const newSystemPrompt: Prompt = {
      name: 'system',
      description: 'System prompt with debugging capabilities',
      text: debuggingCapabilitiesPrompt
    };
    await promptManager.addPrompt(newSystemPrompt);
  }
};