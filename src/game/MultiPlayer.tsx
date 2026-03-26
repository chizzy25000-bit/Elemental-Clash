import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
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

export default function MultiPlayer({ action, roomCode, onExit }: { action: 'host' | 'join', roomCode?: string, onExit: () => void }) {
  const { user } = useAuth();
  const [inLobby, setInLobby] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [initialCoins, setInitialCoins] = useState(0);
  const lastCoinsRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>({ players: {}, projectiles: {}, enemies: {}, lootOrbs: {}, floatingTexts: {}, customElements: {}, hazards: {}, bosses: {}, impactDecals: {}, tiles: {} });
  const [myId, setMyId] = useState<string>('');
  const [currentRoomCode, setCurrentRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const isHostRef = useRef(false);
  const userRef = useRef(user);
  
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const [error, setError] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, aimX: 0, aimY: 0, isShooting: false });
  const lastShotsRef = useRef(new Map<string, number>());
  const lastUltimatesRef = useRef(new Map<string, number>());
  const inputsRef = useRef<Map<string, InputState>>(new Map());
  const myIdRef = useRef<string>('');

  const getHostToken = () => {
    let token = localStorage.getItem('elemental_clash_host_token');
    if (!token) {
      token = Math.random().toString(36).substring(2);
      localStorage.setItem('elemental_clash_host_token', token);
    }
    return token;
  };

  // Use refs to avoid recreating socket on state changes
  const inLobbyRef = useRef(inLobby);
  const showBuilderRef = useRef(showBuilder);
  const showForgeRef = useRef(showForge);

  useEffect(() => {
    inLobbyRef.current = inLobby;
    showBuilderRef.current = showBuilder;
    showForgeRef.current = showForge;
  }, [inLobby, showBuilder, showForge]);

    useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    const globalCoins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
    const cloudInventory = JSON.parse(localStorage.getItem('elemental_clash_cloud_inventory') || '[]');
    const cloudLoadout = JSON.parse(localStorage.getItem('elemental_clash_cloud_loadout') || '{"attack":null,"defense":null,"mobility":null,"healing":null,"ultimate":null}');
    const cloudCustomElements = JSON.parse(localStorage.getItem('elemental_clash_cloud_custom_elements') || '{}');

    if (action === 'host') {
      socket.emit('create_room', { 
        coins: globalCoins, 
        hostToken: getHostToken(),
        inventory: cloudInventory,
        loadout: cloudLoadout,
        customElements: cloudCustomElements
      });
    } else if (action === 'join' && roomCode) {
      socket.emit('join_room', { 
        code: roomCode, 
        coins: globalCoins, 
        hostToken: getHostToken(),
        inventory: cloudInventory,
        loadout: cloudLoadout,
        customElements: cloudCustomElements
      });
    }

    socket.on('room_joined', ({ code, id, coins, isHost }) => {
      setCurrentRoomCode(code);
      setMyId(id);
      myIdRef.current = id;
      setInitialCoins(coins);
      setIsHost(isHost);
      isHostRef.current = isHost;
      lastCoinsRef.current = coins;
    });

    socket.on('room_error', (msg) => {
      setError(msg);
    });

    socket.on('pause_state', (isPaused: boolean) => {
      setShowPause(isPaused);
    });

    socket.on('player_input', ({ id, input }: { id: string, input: InputState }) => {
      inputsRef.current.set(id, input);
    });

    socket.on('state', (state: GameState) => {
      // Only non-hosts should overwrite their entire state from the server
      // Hosts are the source of truth
      if (!isHostRef.current) {
        setGameState(state);
      }
      
      // Sync global coins and cloud data
      if (myIdRef.current && state.players[myIdRef.current]) {
        const p = state.players[myIdRef.current];
        let changed = false;

        if (p.coins !== lastCoinsRef.current) {
          lastCoinsRef.current = p.coins;
          setInitialCoins(p.coins);
          window.dispatchEvent(new CustomEvent('coins_changed', { detail: p.coins }));
          changed = true;
        }

        if (userRef.current) {
          const localInv = JSON.stringify(p.inventory);
          const cloudInv = localStorage.getItem('elemental_clash_cloud_inventory');
          if (localInv !== cloudInv) {
            localStorage.setItem('elemental_clash_cloud_inventory', localInv);
            changed = true;
          }

          const localLoadout = JSON.stringify(p.loadout);
          const cloudLoadout = localStorage.getItem('elemental_clash_cloud_loadout');
          if (localLoadout !== cloudLoadout) {
            localStorage.setItem('elemental_clash_cloud_loadout', localLoadout);
            changed = true;
          }

          const localCE = JSON.stringify(state.customElements);
          const cloudCE = localStorage.getItem('elemental_clash_cloud_custom_elements');
          if (localCE !== cloudCE) {
            localStorage.setItem('elemental_clash_cloud_custom_elements', localCE);
            changed = true;
          }

          if (changed) {
            window.dispatchEvent(new CustomEvent('sync_to_cloud'));
          }
        }
      }
    });

    // Local Game Loop (60fps)
    let lastTime = Date.now();
    const TICK_RATE = 1000 / 60;
    const intervalId = setInterval(() => {
      if (inLobbyRef.current || showBuilderRef.current || showForgeRef.current || showPause) {
        lastTime = Date.now();
        return;
      }

      const now = Date.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Local simulation
      setGameState(prevState => {
        // Deep clone top-level objects to trigger React re-render
        const nextState: GameState = { 
          ...prevState,
          players: { ...prevState.players },
          projectiles: { ...prevState.projectiles },
          enemies: { ...prevState.enemies },
          bosses: { ...prevState.bosses },
          lootOrbs: { ...prevState.lootOrbs },
          floatingTexts: { ...prevState.floatingTexts },
          hazards: { ...prevState.hazards },
          impactDecals: { ...prevState.impactDecals }
        };
        
        // Update inputs with our own local input
        if (myIdRef.current) {
          inputsRef.current.set(myIdRef.current, inputRef.current);
        }
        
        // Run game logic locally
        updateGameState(nextState, inputsRef.current, lastShotsRef.current, lastUltimatesRef.current, now, dt, true, myIdRef.current);
        
        // If Host, sync to server
        if (isHostRef.current && socket.connected) {
          socket.emit('sync_state', nextState);
        } else if (socket.connected) {
          // If not Host, just send our input (server will relay it)
          socket.emit('input', inputRef.current);
        }

        return nextState;
      });
    }, TICK_RATE);

    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [action, roomCode]); // Removed isHost and myId to prevent infinite reconnects

  // Local orb collection for instant feedback
  useEffect(() => {
    if (!socketRef.current || !gameState.players[myId]) return;
    const myPlayer = gameState.players[myId];

    Object.values(gameState.lootOrbs).forEach((orb: any) => {
      const dist = Math.hypot(myPlayer.x - orb.x, myPlayer.y - orb.y);
      if (dist < 30) {
        // Optimistic local pickup
        myPlayer.coins += orb.coins;
        delete gameState.lootOrbs[orb.id];
        socketRef.current?.emit('collect_orb', orb.id);
      }
    });
  }, [gameState, myId]);

  const handleSpawn = (pvePenalty: number, pvpPenalty: number) => {
    if (socketRef.current) {
      const globalCoins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
      const cloudInventory = JSON.parse(localStorage.getItem('elemental_clash_cloud_inventory') || '[]');
      const cloudLoadout = JSON.parse(localStorage.getItem('elemental_clash_cloud_loadout') || '{"attack":null,"defense":null,"mobility":null,"healing":null,"ultimate":null}');
      
      socketRef.current.emit('spawn', { 
        pvePenalty, 
        pvpPenalty, 
        coins: globalCoins,
        inventory: cloudInventory,
        loadout: cloudLoadout,
        displayName: user?.displayName || `Player ${myId.substring(0, 4)}`
      });
    }
    setInLobby(false);
  };

  const handleBuy = (element: ElementType) => {
    if (socketRef.current) {
      socketRef.current.emit('buy', { element });
    }
  };

  const handleEquip = (slot: keyof Loadout, element: ElementType | null) => {
    if (socketRef.current) {
      socketRef.current.emit('equip', { slot, element });
    }
  };

  const handleForge = (newElement: CustomElement, cost: number, consumedElements?: ElementType[]) => {
    if (socketRef.current) {
      socketRef.current.emit('forge_element', { newElement, cost, consumedElements });
    }
  };

  const handleTogglePause = () => {
    if (socketRef.current) {
      socketRef.current.emit('toggle_pause');
    }
  };

  const handleDeleteServer = () => {
    if (socketRef.current) {
      socketRef.current.emit('delete_room', { hostToken: getHostToken() });
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white">
        <h2 className="text-2xl font-bold text-red-500 mb-4">{error}</h2>
        <button onClick={onExit} className="px-6 py-2 bg-slate-700 rounded-lg hover:bg-slate-600">Back</button>
      </div>
    );
  }

  if (!myId) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white relative">
        <div className="absolute top-4 left-4 z-[100]">
          <button 
            onPointerDown={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="px-4 py-2 bg-slate-800/80 backdrop-blur text-white rounded-lg hover:bg-slate-700 pointer-events-auto border border-slate-600 shadow-lg cursor-pointer"
          >
            Cancel
          </button>
        </div>
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold">Connecting to Server...</h2>
      </div>
    );
  }

  if (inLobby) {
    return <Lobby mode="multi" players={gameState.players} initialCoins={initialCoins} roomCode={currentRoomCode} isHost={isHost} onSpawn={handleSpawn} onExit={onExit} onDeleteServer={handleDeleteServer} />;
  }

  const player = gameState.players[myId];

  const handleEnemyIntent = (enemyId: string, intent: any) => {
    socketRef.current?.emit('enemy_intent', { enemyId, intent });
  };

  return (
    <>
      <GeminiAIController 
        gameState={gameState} 
        onIntent={handleEnemyIntent} 
        isActive={isHost && !showPause && !showBuilder && !showForge} 
      />
      <Renderer 
        gameState={gameState} 
        myId={myId} 
        onInput={(input) => { inputRef.current = input; }} 
        onExit={onExit} 
        onPause={isHost ? handleTogglePause : undefined}
        onOpenBuilder={() => setShowBuilder(true)}
        isBuilderOpen={showBuilder}
        onOpenForge={() => setShowForge(true)}
        isForgeOpen={showForge}
      />
      {showPause && (
        <PauseMenu 
          onResume={isHost ? handleTogglePause : undefined}
          onExit={onExit}
          isHost={isHost}
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
