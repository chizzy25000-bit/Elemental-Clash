import { useState } from 'react';

interface Props {
  mode: 'single' | 'multi';
  initialCoins: number;
  roomCode?: string;
  isHost?: boolean;
  onSpawn: (pvePenalty: number, pvpPenalty: number) => void;
  onExit: () => void;
  onDeleteServer?: () => void;
}

export default function Lobby({ mode, initialCoins, roomCode, isHost, onSpawn, onExit, onDeleteServer }: Props) {
  const [pvePenalty, setPvePenalty] = useState(30);
  const [pvpPenalty, setPvpPenalty] = useState(40);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

      <div className="z-10 flex flex-col items-center bg-slate-800/80 p-8 rounded-2xl border border-slate-600 shadow-2xl backdrop-blur-sm w-full max-w-md">
        <h2 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-emerald-400">
          High-Stakes Lobby
        </h2>
        
        {roomCode && (
          <div className="bg-slate-900/80 border border-emerald-500/30 px-6 py-3 rounded-xl mb-6 flex flex-col items-center">
            <span className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">Room Code</span>
            <span className="text-3xl font-mono font-black tracking-widest text-emerald-400">{roomCode}</span>
          </div>
        )}

        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 w-full mb-6 flex flex-col items-center">
          <span className="text-slate-400 text-sm uppercase tracking-wider font-bold mb-1">Current Balance</span>
          <span className="text-4xl font-black text-yellow-400">{initialCoins} <span className="text-xl">Coins</span></span>
          {initialCoins === 500 && (
            <span className="text-emerald-400 text-xs mt-2 bg-emerald-400/10 px-2 py-1 rounded">New Player Grant Applied!</span>
          )}
        </div>

        <div className="w-full space-y-6 mb-8">
          <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
            <span className="text-xl">📺</span> Watch Ad for 1.5x Coin Multiplier
          </button>
          <div>
            <div className="flex justify-between mb-2">
              <label className="font-bold text-slate-300">PvE Death Penalty</label>
              <span className="text-orange-400 font-bold">
                {pvePenalty}% <span className="text-orange-300/70 text-sm">(-{Math.floor(initialCoins * (pvePenalty / 100))} Coins)</span>
              </span>
            </div>
            <input 
              type="range" 
              min="30" 
              max="100" 
              value={pvePenalty} 
              onChange={(e) => setPvePenalty(parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
            <p className="text-xs text-slate-500 mt-1">Minimum 30% coin loss when killed by environment/AI.</p>
          </div>

          {mode === 'multi' && (
            <div>
              <div className="flex justify-between mb-2">
                <label className="font-bold text-slate-300">PvP Death Penalty</label>
                <span className="text-red-400 font-bold">
                  {pvpPenalty}% <span className="text-red-300/70 text-sm">(-{Math.floor(initialCoins * (pvpPenalty / 100))} Coins)</span>
                </span>
              </div>
              <input 
                type="range" 
                min="40" 
                max="100" 
                value={pvpPenalty} 
                onChange={(e) => setPvpPenalty(parseInt(e.target.value))}
                className="w-full accent-red-500"
              />
              <p className="text-xs text-slate-500 mt-1">Minimum 40% coin loss when killed by players.</p>
            </div>
          )}
        </div>

        <div className="flex gap-4 w-full">
          <button 
            onClick={onExit}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-colors"
          >
            Back
          </button>
          {isHost && onDeleteServer && (
            <button 
              onClick={onDeleteServer}
              className="flex-1 py-3 bg-red-900/50 hover:bg-red-600 text-red-200 rounded-xl font-bold transition-colors"
            >
              Close Server
            </button>
          )}
          <button 
            onClick={() => onSpawn(pvePenalty, mode === 'multi' ? pvpPenalty : 0)}
            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-xl font-bold shadow-lg transition-all"
          >
            Spawn
          </button>
        </div>
      </div>
    </div>
  );
}
