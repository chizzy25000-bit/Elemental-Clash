import { useState } from 'react';
import { Player } from '../shared';
import { requestAd } from '../lib/crazygames';
import { useCoins } from '../contexts/CoinContext';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  mode: 'single' | 'multi';
  players?: Record<string, Player>;
  initialCoins: number;
  roomCode?: string;
  isHost?: boolean;
  onSpawn: (pvePenalty: number, pvpPenalty: number) => void;
  onExit: () => void;
  onDeleteServer?: () => void;
}

export default function Lobby({ mode, players, initialCoins, roomCode, isHost, onSpawn, onExit, onDeleteServer }: Props) {
  const [pvePenalty, setPvePenalty] = useState(30);
  const [pvpPenalty, setPvpPenalty] = useState(40);
  const { addCoins } = useCoins();
  const { isCrazyGames } = useAuth();
  const [adLoading, setAdLoading] = useState(false);

  const handleRewardedAd = () => {
    setAdLoading(true);
    requestAd('rewarded', () => {
      addCoins(100);
      setAdLoading(false);
    }, () => {
      setAdLoading(false);
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans relative overflow-hidden p-4">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

      <div className="z-10 flex flex-col items-center bg-slate-800/80 p-8 rounded-2xl border border-slate-600 shadow-2xl backdrop-blur-sm w-full max-w-2xl overflow-y-auto max-h-[90vh]">
        <h2 className="text-3xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-emerald-400">
          Lobby
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
          <div className="space-y-6">
            {roomCode && (
              <div className="bg-slate-900/80 border border-emerald-500/30 px-6 py-3 rounded-xl flex flex-col items-center">
                <span className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-1">Room Code</span>
                <span className="text-3xl font-mono font-black tracking-widest text-emerald-400">{roomCode}</span>
              </div>
            )}

            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 w-full flex flex-col items-center">
              <span className="text-slate-400 text-sm uppercase tracking-wider font-bold mb-1">Current Balance</span>
              <span className="text-4xl font-black text-yellow-400">{initialCoins} <span className="text-xl">Coins</span></span>
              
              {isCrazyGames && (
                <button 
                  onClick={handleRewardedAd}
                  disabled={adLoading}
                  className="mt-4 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg"
                >
                  {adLoading ? 'Loading Ad...' : '📺 Get 100 Coins'}
                </button>
              )}
            </div>
          </div>

          {/* Players List */}
          {mode === 'multi' && players && (
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 w-full">
              <h3 className="font-bold text-slate-300 mb-2">Players</h3>
              <div className="space-y-2">
                {Object.values(players).map(player => (
                  <div key={player.id} className="flex items-center gap-3 bg-slate-800 p-2 rounded-lg">
                    <div className="w-8 h-8 rounded-full" style={{ backgroundColor: player.color }}></div>
                    <span className="font-mono">👤 {player.displayName || player.id.substring(0, 5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-full space-y-6 mt-8 mb-8">
          {/* ... (keep existing penalty sliders) */}
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
