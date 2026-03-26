import React from 'react';

interface Props {
  onResume?: () => void;
  onExit: () => void;
  isHost?: boolean;
}

export default function PauseMenu({ onResume, onExit, isHost = true }: Props) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-900 p-8 rounded-2xl border border-slate-700 flex flex-col gap-4 w-64">
        <h2 className="text-2xl font-bold text-white text-center">Paused</h2>
        {isHost && onResume ? (
          <button onClick={onResume} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold transition-colors">Resume</button>
        ) : (
          <p className="text-slate-400 text-center text-sm">Waiting for host to resume...</p>
        )}
        <button onClick={onExit} className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold transition-colors">Exit</button>
      </div>
    </div>
  );
}
