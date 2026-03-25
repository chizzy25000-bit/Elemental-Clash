import { useState, useEffect } from 'react';
import SinglePlayer from './game/SinglePlayer';
import MultiPlayer from './game/MultiPlayer';
import ErrorBoundary from './components/ErrorBoundary';
import DebugLogger from './components/DebugLogger';

interface World {
  id: string;
  name: string;
  lastPlayed: number;
}

export default function App() {
  const [mode, setMode] = useState<'menu' | 'sp_menu' | 'sp_play' | 'mp_menu' | 'mp_play'>('menu');
  const [spReset, setSpReset] = useState(false);
  const [selectedWorldId, setSelectedWorldId] = useState<string>('');
  const [worlds, setWorlds] = useState<World[]>([]);
  const [mpAction, setMpAction] = useState<'host' | 'join'>('host');
  const [mpCode, setMpCode] = useState('');
  const [coins, setCoins] = useState(500);

  useEffect(() => {
    const savedCoins = localStorage.getItem('elemental_clash_global_coins');
    if (savedCoins) setCoins(parseInt(savedCoins, 10));

    const savedWorlds = localStorage.getItem('elemental_clash_worlds');
    if (savedWorlds) setWorlds(JSON.parse(savedWorlds));

    const handleCoinsChanged = (e: any) => {
      setCoins(e.detail);
      localStorage.setItem('elemental_clash_global_coins', e.detail.toString());
    };
    window.addEventListener('coins_changed', handleCoinsChanged);
    return () => window.removeEventListener('coins_changed', handleCoinsChanged);
  }, []);

  const createNewWorld = () => {
    const id = Math.random().toString(36).substring(2, 9);
    const newWorld = { id, name: `World ${worlds.length + 1}`, lastPlayed: Date.now() };
    const newWorlds = [...worlds, newWorld];
    setWorlds(newWorlds);
    localStorage.setItem('elemental_clash_worlds', JSON.stringify(newWorlds));
    setSelectedWorldId(id);
    setSpReset(true);
    setMode('sp_play');
  };

  const loadWorld = (id: string) => {
    const newWorlds = worlds.map(w => w.id === id ? { ...w, lastPlayed: Date.now() } : w);
    setWorlds(newWorlds);
    localStorage.setItem('elemental_clash_worlds', JSON.stringify(newWorlds));
    setSelectedWorldId(id);
    setSpReset(false);
    setMode('sp_play');
  };

  const deleteWorld = (id: string) => {
    const newWorlds = worlds.filter(w => w.id !== id);
    setWorlds(newWorlds);
    localStorage.setItem('elemental_clash_worlds', JSON.stringify(newWorlds));
    localStorage.removeItem(`elemental_clash_world_${id}`);
  };

  if (mode === 'sp_play') return <ErrorBoundary><DebugLogger /><SinglePlayer worldId={selectedWorldId} reset={spReset} onExit={() => setMode('menu')} /></ErrorBoundary>;
  if (mode === 'mp_play') return <ErrorBoundary><DebugLogger /><MultiPlayer action={mpAction} roomCode={mpCode} onExit={() => setMode('menu')} /></ErrorBoundary>;

  return (
    <ErrorBoundary>
      <DebugLogger />
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white font-sans relative overflow-hidden">
        {/* Coin Bar */}
        <div className="absolute top-6 right-6 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-xl p-3 px-5 text-white shadow-lg flex items-center gap-3 z-50">
          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-yellow-900 font-black text-lg shadow-[0_0_15px_rgba(250,204,21,0.5)]">
            $
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">Balance</span>
            <span className="text-xl font-black text-yellow-400 leading-none">{coins}</span>
          </div>
        </div>

        {/* Background decorative elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>

        <div className="z-10 flex flex-col items-center">
          <h1 className="text-6xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-blue-400 to-emerald-400 drop-shadow-lg text-center">
            Elemental Clash
          </h1>
          <p className="text-slate-400 mb-12 max-w-md text-center text-lg">
            Phase 1: Infinite World & Cross-Platform Controls
          </p>
          
          <div className="flex flex-col gap-6 w-72">
            {mode === 'menu' && (
              <>
                <button 
                  onClick={() => setMode('sp_menu')}
                  className="group relative px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-xl transition-all shadow-xl overflow-hidden"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  Single Player
                  <div className="text-xs text-slate-400 font-normal mt-1">Saves locally to your device</div>
                </button>
                
                <button 
                  onClick={() => setMode('mp_menu')}
                  className="group relative px-6 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-xl transition-all shadow-xl overflow-hidden"
                >
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-emerald-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  Multiplayer
                  <div className="text-xs text-slate-400 font-normal mt-1">Connect to the MMO Server</div>
                </button>
              </>
            )}

            {mode === 'sp_menu' && (
              <div className="flex flex-col gap-3 w-80">
                <h2 className="text-xl font-bold text-slate-300 mb-2 border-b border-slate-700 pb-2">Select World</h2>
                
                <div className="max-h-60 overflow-y-auto flex flex-col gap-2 pr-2">
                  {worlds.length === 0 ? (
                    <div className="text-slate-500 text-center py-4 italic">No worlds found</div>
                  ) : (
                    worlds.sort((a, b) => b.lastPlayed - a.lastPlayed).map(w => (
                      <div key={w.id} className="flex gap-2">
                        <button 
                          onClick={() => loadWorld(w.id)}
                          className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-left transition-colors shadow-lg flex justify-between items-center"
                        >
                          <span>{w.name}</span>
                          <span className="text-xs text-slate-500 font-normal">
                            {new Date(w.lastPlayed).toLocaleDateString()}
                          </span>
                        </button>
                        <button 
                          onClick={() => deleteWorld(w.id)}
                          className="px-3 bg-red-900/50 hover:bg-red-600 rounded-xl text-red-200 transition-colors"
                          title="Delete World"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <button 
                  onClick={createNewWorld}
                  className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition-colors shadow-lg"
                >
                  + Create New World
                </button>
                
                <button 
                  onClick={() => setMode('menu')}
                  className="w-full py-2 mt-2 text-slate-400 hover:text-white transition-colors"
                >
                  Back
                </button>
              </div>
            )}

            {mode === 'mp_menu' && (
              <>
                <button 
                  onClick={() => { setMpAction('host'); setMode('mp_play'); }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-lg transition-colors shadow-lg"
                >
                  Host Server
                </button>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Enter Code" 
                    value={mpCode}
                    onChange={(e) => setMpCode(e.target.value.toLowerCase())}
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 font-mono text-center"
                    maxLength={6}
                  />
                  <button 
                    onClick={() => { if(mpCode) { setMpAction('join'); setMode('mp_play'); } }}
                    className="py-4 px-6 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors shadow-lg disabled:opacity-50"
                    disabled={!mpCode}
                  >
                    Join
                  </button>
                </div>

                <button 
                  onClick={() => setMode('menu')}
                  className="w-full py-2 mt-4 text-slate-400 hover:text-white transition-colors"
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
