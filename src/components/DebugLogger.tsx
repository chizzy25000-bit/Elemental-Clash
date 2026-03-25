import { useState, useEffect } from 'react';

export default function DebugLogger() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      setLogs(prev => [...prev, args.join(' ')].slice(-5));
      originalConsoleError(...args);
    };

    window.addEventListener('unhandledrejection', (event) => {
      setLogs(prev => [...prev, `Unhandled Rejection: ${event.reason}`].slice(-5));
    });

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  if (logs.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/80 text-red-500 p-4 text-xs font-mono z-[9999] overflow-auto max-h-40">
      {logs.map((log, i) => <div key={i}>{log}</div>)}
    </div>
  );
}
