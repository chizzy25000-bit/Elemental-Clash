import { useEffect, useState, useRef } from 'react';
import { GameState, InputState, ElementType, Loadout } from '../shared';
import { updateGameState, dropLoot } from '../gameLogic';
import Renderer from './Renderer';
import PauseMenu from '../components/PauseMenu';
import Lobby from '../components/Lobby';
import Builder from '../components/Builder';
import AlchemyForge from '../components/AlchemyForge';
import { CustomElement, getInventoryKey, getLoadoutKey, getCustomElementsKey } from '../shared';
import { useAuth } from '../contexts/AuthContext';
import { useCoins } from '../contexts/CoinContext';
import { gameplayStart, gameplayStop, happyTime, requestAd } from '../lib/crazygames';

export default function SinglePlayer({ worldId, reset, onExit }: { worldId: string, reset?: boolean, onExit: () => void }) {
  const { user, isCrazyGames } = useAuth();
  const { coins, setCoins, spendCoins, addCoins } = useCoins();
  const [inLobby, setInLobby] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [gameState, setGameState] = useState<GameState>({ players: {}, projectiles: {}, enemies: {}, lootOrbs: {}, floatingTexts: {}, customElements: {}, hazards: {}, bosses: {}, impactDecals: {}, tiles: {} });
  const stateRef = useRef<GameState>({
    players: {
      'local': { 
        id: 'local', x: 0, y: 0, color: '#3b82f6', speed: 5, vx: 0, vy: 0, coins: coins, pvePenalty: 30, pvpPenalty: 0,
        inventory: [],
        loadout: { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
        hp: 100, maxHp: 100,
        statusEffects: [],
        isDead: false
      }
    },
    projectiles: {},
    enemies: {},
    lootOrbs: {},
    floatingTexts: {},
    customElements: {},
    hazards: {},
    bosses: {},
    impactDecals: {},
    tiles: {}
  });
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, aimX: 0, aimY: 0, isShooting: false });
  const lastShotRef = useRef(0);
  const lastUltimatesRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (reset) {
      localStorage.removeItem(`elemental_clash_world_${worldId}`);
      
      // If logged in, use cloud data as base
      const cloudInventory = user ? JSON.parse(localStorage.getItem(getInventoryKey(user.uid)) || '[]') : [];
      const cloudLoadout = user ? JSON.parse(localStorage.getItem(getLoadoutKey(user.uid)) || '{"attack":null,"defense":null,"mobility":null,"healing":null,"ultimate":null}') : { attack: null, defense: null, mobility: null, healing: null, ultimate: null };
      const cloudCustomElements = user ? JSON.parse(localStorage.getItem(getCustomElementsKey(user.uid)) || '{}') : {};

      stateRef.current.players['local'] = {
        id: 'local', x: 0, y: 0, color: '#3b82f6', speed: 5, vx: 0, vy: 0, coins: coins, pvePenalty: 30, pvpPenalty: 0,
        inventory: cloudInventory,
        loadout: cloudLoadout,
        hp: 100, maxHp: 100,
        statusEffects: [],
        isDead: false
      };
      stateRef.current.enemies = {};
      stateRef.current.projectiles = {};
      stateRef.current.lootOrbs = {};
      stateRef.current.floatingTexts = {};
      stateRef.current.customElements = cloudCustomElements;
      stateRef.current.hazards = {};
      stateRef.current.bosses = {};
      stateRef.current.impactDecals = {};
    } else {
      // Load from localStorage
      const saved = localStorage.getItem(`elemental_clash_world_${worldId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.players && parsed.players['local']) {
            const p = parsed.players['local'];
            if (p) {
              if (typeof p.x !== 'number' || isNaN(p.x)) p.x = 0;
              if (typeof p.y !== 'number' || isNaN(p.y)) p.y = 0;
              
              // Merge with cloud data if logged in
              const inventory = user ? JSON.parse(localStorage.getItem(getInventoryKey(user.uid)) || '[]') : (p.inventory || []);
              const loadout = user ? JSON.parse(localStorage.getItem(getLoadoutKey(user.uid)) || '{"attack":null,"defense":null,"mobility":null,"healing":null,"ultimate":null}') : (p.loadout || { attack: null, defense: null, mobility: null, healing: null, ultimate: null });

              stateRef.current.players['local'] = {
                id: 'local',
                x: p.x,
                y: p.y,
                color: p.color || '#3b82f6',
                speed: p.speed || 5,
                vx: 0,
                vy: 0,
                coins: coins,
                pvePenalty: p.pvePenalty || 30,
                pvpPenalty: p.pvpPenalty || 0,
                inventory,
                loadout,
                hp: p.hp || 100,
                maxHp: p.maxHp || 100,
                statusEffects: p.statusEffects || [],
                isDead: p.isDead || false
              };
            }
          }
          if (parsed.customElements) {
            const cloudCustomElements = user ? JSON.parse(localStorage.getItem(getCustomElementsKey(user.uid)) || '{}') : parsed.customElements;
            stateRef.current.customElements = cloudCustomElements;
          }
        } catch(e) {}
      }
    }
  }, [reset, worldId, user, coins]);

  useEffect(() => {
    if (!inLobby) {
      gameplayStart();
      return () => gameplayStop();
    }
  }, [inLobby]);

  useEffect(() => {
    if (inLobby) return;

    let lastTime = Date.now();
    const TICK_RATE = 1000 / 60;
    const intervalId = setInterval(() => {
      if (showBuilder || showForge || showPause || stateRef.current.players['local']?.isDead) {
        lastTime = Date.now(); // Reset lastTime when unpausing
        return; 
      }
      
      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const state = stateRef.current;
      const inputs = new Map<string, InputState>();
      inputs.set('local', inputRef.current);
      
      const lastShots = new Map<string, number>();
      lastShots.set('local', lastShotRef.current);

      const oldBossCount = Object.keys(state.bosses).length;
      updateGameState(state, inputs, lastShots, lastUltimatesRef.current, now, dt, false);
      const newBossCount = Object.keys(state.bosses).length;

      if (newBossCount < oldBossCount) {
        happyTime();
      }
      
      lastShotRef.current = lastShots.get('local') || 0;

      // Sync global coins
      if (state.players['local'] && state.players['local'].coins !== coins) {
        setCoins(state.players['local'].coins);
      }

      // Force re-render by cloning state
      setGameState({
        players: { ...state.players },
        projectiles: { ...state.projectiles },
        enemies: { ...state.enemies },
        lootOrbs: { ...state.lootOrbs },
        floatingTexts: { ...state.floatingTexts },
        customElements: { ...state.customElements },
        bosses: { ...state.bosses },
        hazards: { ...state.hazards },
        impactDecals: { ...state.impactDecals },
        tiles: { ...state.tiles }
      });

    }, TICK_RATE);

    const saveInterval = setInterval(() => {
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
    }, 5000);

    return () => {
      clearInterval(intervalId);
      clearInterval(saveInterval);
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
    };
  }, [inLobby, showBuilder, showForge, showPause, worldId, coins, setCoins]);

  const handleSpawn = (pvePenalty: number, pvpPenalty: number) => {
    const player = stateRef.current.players['local'];
    if (player) {
      player.pvePenalty = pvePenalty;
      player.pvpPenalty = pvpPenalty;
    }
    setInLobby(false);
  };

  const handleRespawn = (useAd = false) => {
    const player = stateRef.current.players['local'];
    if (player) {
      if (!useAd) {
        const penalty = player.pvePenalty;
        const coinsLost = Math.floor(player.coins * (penalty / 100));
        player.coins -= coinsLost;
        if (coinsLost > 0) {
          dropLoot(stateRef.current, player.x, player.y, coinsLost);
        }
      }
      
      player.hp = player.maxHp;
      player.isDead = false;
      player.x = Math.random() * 500 - 250;
      player.y = Math.random() * 500 - 250;
      setGameState({ ...stateRef.current });
    }
  };

  const handleReviveAd = () => {
    setAdLoading(true);
    requestAd('rewarded', () => {
      handleRespawn(true);
      setAdLoading(false);
    }, () => {
      setAdLoading(false);
    });
  };

  const handlePause = () => {
    if (isCrazyGames) {
      requestAd('midroll', () => {
        setShowPause(true);
      });
    } else {
      setShowPause(true);
    }
  };

  const handleBuy = (element: ElementType) => {
    const player = stateRef.current.players['local'];
    if (player && player.coins >= 100 && !player.inventory.includes(element)) {
      spendCoins(100);
      player.coins -= 100;
      player.inventory.push(element);
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
      
      if (user) {
        localStorage.setItem(getInventoryKey(user.uid), JSON.stringify(player.inventory));
        window.dispatchEvent(new CustomEvent('sync_to_cloud'));
      }
    }
  };

  const handleEquip = (slot: keyof Loadout, element: ElementType | null) => {
    const player = stateRef.current.players['local'];
    if (player) {
      player.loadout[slot] = element;
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
      
      if (user) {
        localStorage.setItem(getLoadoutKey(user.uid), JSON.stringify(player.loadout));
        window.dispatchEvent(new CustomEvent('sync_to_cloud'));
      }
    }
  };

  const handleForge = (newElement: CustomElement, cost: number, consumedElements?: ElementType[]) => {
    const player = stateRef.current.players['local'];
    if (player && player.coins >= cost) {
      spendCoins(cost);
      player.coins -= cost;
      if (!stateRef.current.customElements) {
        stateRef.current.customElements = {};
      }
      stateRef.current.customElements[newElement.id] = newElement;
      
      // Remove consumed elements
      if (consumedElements) {
        consumedElements.forEach(id => {
          const index = (player.inventory || []).indexOf(id);
          if (index !== -1) {
            player.inventory.splice(index, 1);
          }
        });
      }

      player.inventory.push(newElement.id);
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
      
      if (user) {
        localStorage.setItem(getInventoryKey(user.uid), JSON.stringify(player.inventory));
        localStorage.setItem(getCustomElementsKey(user.uid), JSON.stringify(stateRef.current.customElements));
        window.dispatchEvent(new CustomEvent('sync_to_cloud'));
      }
    }
  };

  if (inLobby) {
    return <Lobby mode="single" initialCoins={coins} onSpawn={handleSpawn} onExit={onExit} />;
  }

  const player = gameState.players['local'];

  return (
    <>
      <Renderer 
        gameState={gameState} 
        myId="local" 
        onInput={(input) => { inputRef.current = input; }} 
        onExit={onExit} 
        onPause={handlePause}
        onOpenBuilder={() => setShowBuilder(true)}
        isBuilderOpen={showBuilder}
        onOpenForge={() => setShowForge(true)}
        isForgeOpen={showForge}
      />
      {showPause && (
        <PauseMenu 
          onResume={() => setShowPause(false)}
          onExit={onExit}
        />
      )}
      {player?.isDead && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
          <div className="w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <span className="text-5xl">💀</span>
          </div>
          <h2 className="text-4xl font-black text-red-500 mb-2">You Were Defeated</h2>
          <p className="text-slate-400 mb-8 max-w-md">
            The void has consumed you. You will lose <span className="text-orange-400 font-bold">{player.pvePenalty}%</span> of your coins if you respawn now.
          </p>
          
          <div className="flex flex-col gap-4 w-full max-w-xs">
            {isCrazyGames && (
              <button 
                onClick={handleReviveAd}
                disabled={adLoading}
                className="w-full py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 disabled:opacity-50 rounded-2xl font-black text-lg shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
              >
                {adLoading ? 'Loading Ad...' : '📺 Revive (Keep Coins)'}
              </button>
            )}
            <button 
              onClick={() => handleRespawn(false)}
              className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-2xl font-bold text-lg transition-all"
            >
              Respawn (-{Math.floor(player.coins * (player.pvePenalty / 100))} Coins)
            </button>
            <button 
              onClick={onExit}
              className="w-full py-3 text-slate-500 hover:text-slate-300 font-bold transition-all"
            >
              Exit to Menu
            </button>
          </div>
        </div>
      )}
      {showBuilder && player && (
        <Builder 
          coins={player.coins}
          inventory={player.inventory}
          loadout={player.loadout}
          onBuy={handleBuy}
          onEquip={handleEquip}
          onClose={() => setShowBuilder(false)}
          customElements={gameState.customElements || {}}
        />
      )}
      {showForge && player && (
        <AlchemyForge
          coins={player.coins}
          inventory={player.inventory}
          customElements={gameState.customElements || {}}
          onForge={handleForge}
          onClose={() => setShowForge(false)}
        />
      )}
    </>
  );
}
