import { useEffect, useState, useRef } from 'react';
import { GameState, InputState, ElementType, Loadout } from '../shared';
import { updateGameState } from '../gameLogic';
import Renderer from './Renderer';
import PauseMenu from '../components/PauseMenu';
import Lobby from '../components/Lobby';
import Builder from '../components/Builder';
import AlchemyForge from '../components/AlchemyForge';
import { CustomElement } from '../shared';
import { useAuth } from '../contexts/AuthContext';
import GeminiAIController from './GeminiAIController';

export default function SinglePlayer({ worldId, reset, onExit }: { worldId: string, reset?: boolean, onExit: () => void }) {
  const { user } = useAuth();
  const [inLobby, setInLobby] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [initialCoins, setInitialCoins] = useState(500);
  const lastCoinsRef = useRef(500);
  const [gameState, setGameState] = useState<GameState>({ players: {}, projectiles: {}, enemies: {}, lootOrbs: {}, floatingTexts: {}, customElements: {}, hazards: {}, bosses: {}, impactDecals: {}, tiles: {} });
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
    const globalCoins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
    setInitialCoins(globalCoins);
    lastCoinsRef.current = globalCoins;

    if (reset) {
      localStorage.removeItem(`elemental_clash_world_${worldId}`);
      
      // If logged in, use cloud data as base
      const cloudInventory = user ? JSON.parse(localStorage.getItem('elemental_clash_cloud_inventory') || '[]') : [];
      const cloudLoadout = user ? JSON.parse(localStorage.getItem('elemental_clash_cloud_loadout') || '{"attack":null,"defense":null,"mobility":null,"healing":null,"ultimate":null}') : { attack: null, defense: null, mobility: null, healing: null, ultimate: null };
      const cloudCustomElements = user ? JSON.parse(localStorage.getItem('elemental_clash_cloud_custom_elements') || '{}') : {};

      stateRef.current.players['local'] = {
        id: 'local', x: 0, y: 0, color: '#3b82f6', speed: 5, coins: globalCoins, pvePenalty: 30, pvpPenalty: 0,
        inventory: cloudInventory,
        loadout: cloudLoadout,
        hp: 100, maxHp: 100
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
              const inventory = user ? JSON.parse(localStorage.getItem('elemental_clash_cloud_inventory') || '[]') : (p.inventory || []);
              const loadout = user ? JSON.parse(localStorage.getItem('elemental_clash_cloud_loadout') || '{"attack":null,"defense":null,"mobility":null,"healing":null,"ultimate":null}') : (p.loadout || { attack: null, defense: null, mobility: null, healing: null, ultimate: null });

              stateRef.current.players['local'] = {
                id: 'local',
                x: p.x,
                y: p.y,
                color: p.color || '#3b82f6',
                speed: p.speed || 5,
                coins: globalCoins,
                pvePenalty: p.pvePenalty || 30,
                pvpPenalty: p.pvpPenalty || 0,
                inventory,
                loadout,
                hp: p.hp || 100,
                maxHp: p.maxHp || 100
              };
            }
          }
          if (parsed.customElements) {
            const cloudCustomElements = user ? JSON.parse(localStorage.getItem('elemental_clash_cloud_custom_elements') || '{}') : parsed.customElements;
            stateRef.current.customElements = cloudCustomElements;
          }
        } catch(e) {}
      }
    }
  }, [reset, worldId, user]);

  useEffect(() => {
    if (inLobby) return;

    let lastTime = Date.now();
    const TICK_RATE = 1000 / 60;
    const intervalId = setInterval(() => {
      if (showBuilder || showForge || showPause) {
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

      updateGameState(state, inputs, lastShots, lastUltimatesRef.current, now, dt, false);
      
      lastShotRef.current = lastShots.get('local') || 0;

      // Sync global coins
      if (state.players['local'] && state.players['local'].coins !== lastCoinsRef.current) {
        lastCoinsRef.current = state.players['local'].coins;
        setInitialCoins(state.players['local'].coins);
        window.dispatchEvent(new CustomEvent('coins_changed', { detail: state.players['local'].coins }));
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
        impactDecals: { ...state.impactDecals }
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
  }, [inLobby, showBuilder, showForge, showPause, worldId]);

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
      
      if (user) {
        localStorage.setItem('elemental_clash_cloud_inventory', JSON.stringify(player.inventory));
        window.dispatchEvent(new CustomEvent('sync_to_cloud'));
      }

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
      
      if (user) {
        localStorage.setItem('elemental_clash_cloud_loadout', JSON.stringify(player.loadout));
        window.dispatchEvent(new CustomEvent('sync_to_cloud'));
      }
    }
  };

  const handleForge = (newElement: CustomElement, cost: number, consumedElements?: ElementType[]) => {
    const player = stateRef.current.players['local'];
    if (player && player.coins >= cost) {
      player.coins -= cost;
      if (!stateRef.current.customElements) {
        stateRef.current.customElements = {};
      }
      stateRef.current.customElements[newElement.id] = newElement;
      
      // Remove consumed elements
      if (consumedElements) {
        consumedElements.forEach(id => {
          const index = player.inventory.indexOf(id);
          if (index !== -1) {
            player.inventory.splice(index, 1);
          }
        });
      }

      player.inventory.push(newElement.id);
      setGameState({ ...stateRef.current });
      localStorage.setItem(`elemental_clash_world_${worldId}`, JSON.stringify(stateRef.current));
      
      if (user) {
        localStorage.setItem('elemental_clash_cloud_inventory', JSON.stringify(player.inventory));
        localStorage.setItem('elemental_clash_cloud_custom_elements', JSON.stringify(stateRef.current.customElements));
        window.dispatchEvent(new CustomEvent('sync_to_cloud'));
      }

      lastCoinsRef.current = player.coins;
      window.dispatchEvent(new CustomEvent('coins_changed', { detail: player.coins }));
    }
  };

  if (inLobby) {
    return <Lobby mode="single" initialCoins={initialCoins} onSpawn={handleSpawn} onExit={onExit} />;
  }

  const player = gameState.players['local'];

  const handleEnemyIntent = (enemyId: string, intent: any) => {
    const enemy = stateRef.current.enemies[enemyId] || stateRef.current.bosses[enemyId];
    if (enemy) {
      enemy.intent = intent;
    }
  };

  return (
    <>
      <GeminiAIController 
        gameState={gameState} 
        onIntent={handleEnemyIntent} 
        isActive={!showPause && !showBuilder && !showForge} 
      />
      <Renderer 
        gameState={gameState} 
        myId="local" 
        onInput={(input) => { inputRef.current = input; }} 
        onExit={onExit} 
        onPause={() => setShowPause(true)}
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
