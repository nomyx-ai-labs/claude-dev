import React, { useState, useEffect } from 'react';
import { vscode } from '../utils/vscode';

interface Breakpoint {
  id: string;
  filePath: string;
  line: number;
}

const BreakpointList: React.FC = () => {
  const [breakpoints, setBreakpoints] = useState<Breakpoint[]>([]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'debugger' && message.action === 'breakpointsUpdated') {
        setBreakpoints(message.data);
      }
    };

    window.addEventListener('message', handleMessage);

    // Request initial breakpoints
    vscode.postMessage({ type: 'debugger', action: 'getBreakpoints' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const removeBreakpoint = (id: string) => {
    vscode.postMessage({ type: 'debugger', action: 'removeBreakpoint', data: { id } });
  };

  return (
    <div className="breakpoint-list">
      <h3>Breakpoints</h3>
      <ul>
        {breakpoints.map((bp) => (
          <li key={bp.id}>
            {bp.filePath}:{bp.line}
            <button onClick={() => removeBreakpoint(bp.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BreakpointList;