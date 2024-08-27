import React, { useState, useEffect, FormEventHandler, useCallback } from 'react';
import { VSCodeButton, VSCodeTextField, VSCodeDivider } from '@vscode/webview-ui-toolkit/react';
import { Prompt } from '../../../src/shared/Prompt';
import { ExtensionMessage } from '../../../src/shared/ExtensionMessage';

interface PromptManagementViewProps {
  vscode: any;
}

type VSCodeTextFieldChangeHandler = ((e: Event) => unknown) & FormEventHandler<HTMLElement>;

export const PromptManagementView: React.FC<PromptManagementViewProps> = ({ vscode }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [newPrompt, setNewPrompt] = useState<Prompt>({
    name: '',
    system: '',
    user: '',
    request: '',
    response: '',
    description: '',
    category: '',
    tags: [],
  });

  const fetchPrompts = useCallback(async () => {
    vscode.postMessage({ type: 'getPrompts' });
  }, [vscode]);

  useEffect(() => {
    fetchPrompts();

    const handleMessage = (event: MessageEvent) => {
      const message: ExtensionMessage = event.data;
      switch (message.type) {
        case 'prompts':
          setPrompts(message.prompts || []);
          setCategories(Array.from(new Set(message.prompts?.map(p => p.category) || [])));
          break;
        case 'promptSearchResults':
          setPrompts(message.prompts || []);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [fetchPrompts]);

  const handleSearch: VSCodeTextFieldChangeHandler = (event) => {
    const target = event.target as HTMLInputElement;
    setSearchQuery(target.value);
    vscode.postMessage({ type: 'searchPrompts', text: target.value });
  };

  const handlePromptSelect = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setEditMode(false);
  };

  const handlePromptAdd = () => {
    setSelectedPrompt(null);
    setEditMode(true);
    setNewPrompt({
      name: '',
      system: '',
      user: '',
      request: '',
      response: '',
      description: '',
      category: '',
      tags: [],
    });
  };

  const handlePromptEdit = () => {
    if (selectedPrompt) {
      setNewPrompt(selectedPrompt);
      setEditMode(true);
    }
  };

  const handlePromptDelete = () => {
    if (selectedPrompt) {
      vscode.postMessage({ type: 'deletePrompt', promptName: selectedPrompt.name });
      setSelectedPrompt(null);
    }
  };

  const handlePromptSave = () => {
    if (editMode) {
      if (selectedPrompt) {
        vscode.postMessage({ type: 'editPrompt', promptName: selectedPrompt.name, prompt: newPrompt });
      } else {
        vscode.postMessage({ type: 'addPrompt', prompt: newPrompt });
      }
      setEditMode(false);
      setSelectedPrompt(null);
      fetchPrompts();
    }
  };

  const handlePromptExport = () => {
    vscode.postMessage({ type: 'exportPrompts' });
  };

  const handlePromptImport = () => {
    vscode.postMessage({ type: 'importPrompts' });
  };

  const handleInputChange: VSCodeTextFieldChangeHandler = (event) => {
    const target = event.target as HTMLInputElement;
    const { name, value } = target;
    setNewPrompt(prev => ({ ...prev, [name]: value }));
  };

  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prompt.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="prompt-management-view">
      <VSCodeTextField placeholder="Search prompts..." value={searchQuery} onChange={handleSearch} />
      <div className="prompt-list">
        <ul>
          {categories.map(category => (
            <li key={category}>
              <h3>{category}</h3>
              <ul>
                {filteredPrompts
                  .filter(prompt => prompt.category === category)
                  .map(prompt => (
                    <li
                      key={prompt.name}
                      onClick={() => handlePromptSelect(prompt)}
                    >
                      {prompt.name}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <VSCodeDivider />
      {editMode ? (
        <div className="prompt-edit">
          <div>
            <label htmlFor="name">Name:</label>
            <VSCodeTextField id="name" name="name" placeholder="Enter name" value={newPrompt.name} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="system">System Prompt:</label>
            <VSCodeTextField id="system" name="system" placeholder="Enter system prompt" value={newPrompt.system} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="user">User Prompt:</label>
            <VSCodeTextField id="user" name="user" placeholder="Enter user prompt" value={newPrompt.user} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="request">Request Format:</label>
            <VSCodeTextField id="request" name="request" placeholder="Enter request format" value={newPrompt.request} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="response">Response Format:</label>
            <VSCodeTextField id="response" name="response" placeholder="Enter response format" value={newPrompt.response} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="description">Description:</label>
            <VSCodeTextField id="description" name="description" placeholder="Enter description" value={newPrompt.description} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="category">Category:</label>
            <VSCodeTextField id="category" name="category" placeholder="Enter category" value={newPrompt.category} onChange={handleInputChange} />
          </div>
          <div>
            <label htmlFor="tags">Tags (comma-separated):</label>
            <VSCodeTextField 
              id="tags"
              name="tags" 
              placeholder="Enter tags, separated by commas" 
              value={newPrompt.tags.join(',')} 
              onChange={(e: Event | React.FormEvent<HTMLElement>) => {
                const target = e.target as HTMLInputElement;
                setNewPrompt(prev => ({ ...prev, tags: target.value.split(',') }));
              }} 
            />
          </div>
          <VSCodeButton onClick={handlePromptSave}>Save</VSCodeButton>
          <VSCodeButton onClick={() => setEditMode(false)}>Cancel</VSCodeButton>
        </div>
      ) : selectedPrompt ? (
        <div className="prompt-details">
          <h3>{selectedPrompt.name}</h3>
          <p>{selectedPrompt.description}</p>
          <p>Category: {selectedPrompt.category}</p>
          <p>Tags: {selectedPrompt.tags.join(', ')}</p>
          <VSCodeButton onClick={handlePromptEdit}>Edit</VSCodeButton>
          <VSCodeButton onClick={handlePromptDelete}>Delete</VSCodeButton>
        </div>
      ) : null}
      <VSCodeDivider />
      <div className="prompt-actions">
        <VSCodeButton onClick={handlePromptAdd}>Add New Prompt</VSCodeButton>
        <VSCodeButton onClick={handlePromptExport}>Export Prompts</VSCodeButton>
        <VSCodeButton onClick={handlePromptImport}>Import Prompts</VSCodeButton>
      </div>
    </div>
  );
};