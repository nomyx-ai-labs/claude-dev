import React from 'react';
import { vscode } from '../utils/vscode';

const DebugControls: React.FC = () => {
  const startDebugging = () => {
    vscode.postMessage({ type: 'debugger', action: 'startDebugging' });
  };

  const stopDebugging = () => {
    vscode.postMessage({ type: 'debugger', action: 'stopDebugging' });
  };

  const pauseDebugging = () => {
    vscode.postMessage({ type: 'debugger', action: 'pauseDebugging' });
  };

  const continueDebugging = () => {
    vscode.postMessage({ type: 'debugger', action: 'continueDebugging' });
  };

  const stepOver = () => {
    vscode.postMessage({ type: 'debugger', action: 'stepOver' });
  };

  const stepInto = () => {
    vscode.postMessage({ type: 'debugger', action: 'stepInto' });
  };

  const stepOut = () => {
    vscode.postMessage({ type: 'debugger', action: 'stepOut' });
  };

  return (
    <div className="debug-controls">
      <button onClick={startDebugging}>Start</button>
      <button onClick={stopDebugging}>Stop</button>
      <button onClick={pauseDebugging}>Pause</button>
      <button onClick={continueDebugging}>Continue</button>
      <button onClick={stepOver}>Step Over</button>
      <button onClick={stepInto}>Step Into</button>
      <button onClick={stepOut}>Step Out</button>
    </div>
  );
};

export default DebugControls;