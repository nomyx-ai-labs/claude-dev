import React, { useState, useEffect } from 'react';
import { vscode } from '../utils/vscode';

interface Variable {
  name: string;
  value: string;
  type: string;
}

const VariableInspector: React.FC = () => {
  const [variables, setVariables] = useState<Variable[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'debugger' && message.action === 'variablesUpdated') {
        setVariables(message.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial variables
    vscode.postMessage({ type: 'debugger', action: 'getVariables' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="variable-inspector">
      <h3>Variables</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Value</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
          {variables.map((variable, index) => (
            <tr key={index}>
              <td>{variable.name}</td>
              <td>{variable.value}</td>
              <td>{variable.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default VariableInspector;