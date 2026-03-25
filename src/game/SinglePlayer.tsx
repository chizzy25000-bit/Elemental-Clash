import { useEffect, useState, useRef } from 'react';
import { GameState, InputState, ElementType, Loadout } from '../shared';
import { updateGameState } from '../gameLogic';
import Renderer from './Renderer';
import Lobby from '../components/Lobby';
import Builder from '../components/Builder';
import AlchemyForge from '../components/AlchemyForge';
import { CustomElement } from '../shared';

export default function SinglePlayer({ worldId, reset, onExit }: { worldId: string, reset?: boolean, onExit: () => void }) {
  const [inLobby, setInLobby] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [initialCoins, setInitialCoins] = useState(500);
  const lastCoinsRef = useRef(500);
  const [gameState, setGameState] = useState<GameState>({ players: {}, projectiles: {}, enemies: {}, lootOrbs: {}, floatingTexts: {}, customElements: {} });
  const stateRef = useRef<GameState>({
    players: {
      'local': { 
        id: 'local', x: 0, y: 0, color: '#3b82f6', speed: 5, coins: 500, pvePenalty: 30, pvpPenalty: 0,
        inventory: [],
        loadout: { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
        hp: 100, maxHp: 100
      }
    },
    projectiles: {},
    enemies: {},
    lootOrbs: {},
    floatingTexts: {},
    customElements: {}
  });
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, aimX: 0, aimY: 0, isShooting: false });
  const lastShotRef = useRef(0);
  const lastUltimatesRef = useRef(new Map<string, number>());

  useEffect(() => {
    const globalCoins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
    setInitialCoins(globalCoins);
    lastCoinsRef.current = globalCoins;

    if (reset) {
      localStorage.removeItem(`elemental_clash_world_${worldId}`);
      stateRef.current.players['local'] = {
        id: 'local', x: 0, y: 0, color: '#3b82f6', speed: 5, coins: globalCoins, pvePenalty: 30, pvpPenalty: 0,
        inventory: [],
        loadout: { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
        hp: 100, maxHp: 100
      };
      stateRef.current.enemies = {};
      stateRef.current.projectiles = {};
      stateRef.current.lootOrbs = {};
      stateRef.current.floatingTexts = {};
      stateRef.current.customElements = {};
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
              stateRef.current.players['local'] = {
                id: 'local',
                x: p.x,
                y: p.y,
                color: p.color || '#3b82f6',
                speed: p.speed || 5,
                coins: globalCoins,
                pvePenalty: p.pvePenalty || 30,
                pvpPenalty: p.pvpPenalty || 0,
                inventory: p.inventory || [],
                loadout: p.loadout || { attack: null, defense: null, mobility: null, healing: null, ultimate: null },
                hp: p.hp || 100,
                maxHp: p.maxHp || 100
              };
            }
          }
          if (parsed.customElements) {
            stateRef.current.customElements = parsed.customElements;
          }
        } catch(e) {}
      }
    }
  }, [reset, worldId]);

  useEffect(() => {
    if (inLobby) return;

    const TICK_RATE = 1000 / 60;
    const intervalId = setInterval(() => {
      if (showBuilder || showForge) return; // Pause game logic while builder or forge is open
      
      const state = stateRef.current;
      const inputs = new Map<string, InputState>();
      inputs.set('local', inputRef.current);
      
      const lastShots = new Map<string, number>();
      lastShots.set('local', lastShotRef.current);

      updateGameState(state, inputs, lastShots, lastUltimatesRef.current, Date.now(), false);
      
      lastShotRef.current = lastShots.get('local') || 0;

      // Sync global coins
      if (state.players['local'] && state.players['local'].coins !== lastCoinsRef.current) {
        lastCoinsRef.current = state.players['local'].coins;
        window.dispatchEvent(new CustomEvent('coins_changed', { detail: state.players['local'].coins }));
      }

      // Force re-render by cloning state
      setGameState({
        players: { ...state.players },
        projectiles: { ...state.projectiles },
        enemies: { ...state.enemies },
        lootOrbs: { ...state.lootOrbs },
        floatingTexts: { ...state.floatingTexts },
        customElements: { ...state.customElements }
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
  }, [inLobby, showBuilder, showForge, worldId]);

  const handleSpawn = (pvePenalty: number, pvpPenalty: number) => {
    const player = stateRef.current.players['local'];
    if (player) {
      player.pvePenalty = pvePenalty;
      player.pvpPenalty = pvpPenalty;
    }
    setInLobby(false);
  };

  const handleBuy = (element: ElementType) => {
    const player = stateRef.current.players['local'];
    if (player && player.coins >= 100 && !player.inventory.includes(element)) {
      player.coins -= 100;
      player.inventory.push(element);
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
      lastCoinsRef.current = player.coins;
      window.dispatchEvent(new CustomEvent('coins_changed', { detail: player.coins }));
    }
  };

  const handleEquip = (slot: keyof Loadout, element: ElementType | null) => {
    const player = stateRef.current.players['local'];
    if (player) {
      player.loadout[slot] = element;
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
    }
  };

  const handleForge = (newElement: CustomElement, cost: number) => {
    const player = stateRef.current.players['local'];
    if (player && player.coins >= cost) {
      player.coins -= cost;
      if (!stateRef.current.customElements) {
        stateRef.current.customElements = {};
      }
      stateRef.current.customElements[newElement.id] = newElement;
      player.inventory.push(newElement.id);
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
      lastCoinsRef.current = player.coins;
      window.dispatchEvent(new CustomEvent('coins_changed', { detail: player.coins }));
    }
  };

  if (inLobby) {
    return <Lobby mode="single" initialCoins={initialCoins} onSpawn={handleSpawn} onExit={onExit} />;
  }

  const player = gameState.players['local'];

  return (
    <>
      <Renderer 
        gameState={gameState} 
        myId="local" 
        onInput={(input) => { inputRef.current = input; }} 
        onExit={onExit} 
        onOpenBuilder={() => setShowBuilder(true)}
        isBuilderOpen={showBuilder}
        onOpenForge={() => setShowForge(true)}
        isForgeOpen={showForge}
      />
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
