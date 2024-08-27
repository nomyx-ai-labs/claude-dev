import React, { useState, useEffect } from 'react';
import { vscode } from '../utils/vscode';

interface StackFrame {
  id: number;
  name: string;
  source: {
    path: string;
  };
  line: number;
  column: number;
}

const CallStackView: React.FC = () => {
  const [callStack, setCallStack] = useState<StackFrame[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'debugger' && message.action === 'callStackUpdated') {
        setCallStack(message.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial call stack
    vscode.postMessage({ type: 'debugger', action: 'getCallStack' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleFrameClick = (frame: StackFrame) => {
    vscode.postMessage({
      type: 'debugger',
      action: 'selectStackFrame',
      data: { frameId: frame.id }
    });
  };

  return (
    <div className="call-stack-view">
      <h3>Call Stack</h3>
      <ul>
        {callStack.map((frame) => (
          <li key={frame.id} onClick={() => handleFrameClick(frame)}>
            {frame.name} ({frame.source.path}:{frame.line})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CallStackView;