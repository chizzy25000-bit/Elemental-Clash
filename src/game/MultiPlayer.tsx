import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { GameState, InputState, ElementType, Loadout } from '../shared';
import Renderer from './Renderer';
import Lobby from '../components/Lobby';
import Builder from '../components/Builder';
import AlchemyForge from '../components/AlchemyForge';
import { CustomElement } from '../shared';

export default function MultiPlayer({ action, roomCode, onExit }: { action: 'host' | 'join', roomCode?: string, onExit: () => void }) {
  const [inLobby, setInLobby] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showForge, setShowForge] = useState(false);
  const [initialCoins, setInitialCoins] = useState(0);
  const lastCoinsRef = useRef(0);
  const [gameState, setGameState] = useState<GameState>({ players: {}, projectiles: {}, enemies: {}, lootOrbs: {}, floatingTexts: {} });
  const [myId, setMyId] = useState<string>('');
  const [currentRoomCode, setCurrentRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const socketRef = useRef<Socket | null>(null);
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, aimX: 0, aimY: 0, isShooting: false });

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

    if (action === 'host') {
      socket.emit('create_room', { coins: globalCoins, hostToken: getHostToken() });
    } else if (action === 'join' && roomCode) {
      socket.emit('join_room', { code: roomCode, coins: globalCoins, hostToken: getHostToken() });
    }

    socket.on('room_joined', ({ code, id, coins, isHost }) => {
      setCurrentRoomCode(code);
      setMyId(id);
      setInitialCoins(coins);
      setIsHost(isHost);
      lastCoinsRef.current = coins;
    });

    socket.on('room_error', (msg) => {
      setError(msg);
    });

    socket.on('state', (state: GameState) => {
      setGameState(state);
      
      // Sync global coins
      if (myId && state.players[myId] && state.players[myId].coins !== lastCoinsRef.current) {
        lastCoinsRef.current = state.players[myId].coins;
        window.dispatchEvent(new CustomEvent('coins_changed', { detail: state.players[myId].coins }));
      }
    });

    // Send inputs to server at 30fps
    const intervalId = setInterval(() => {
      if (socket.connected && !inLobbyRef.current && !showBuilderRef.current && !showForgeRef.current) {
        socket.emit('input', inputRef.current);
      }
    }, 1000 / 30);

    return () => {
      clearInterval(intervalId);
      socket.disconnect();
    };
  }, [action, roomCode]); // Run when action or roomCode changes

  const handleSpawn = (pvePenalty: number, pvpPenalty: number) => {
    if (socketRef.current) {
      const globalCoins = parseInt(localStorage.getItem('elemental_clash_global_coins') || '500', 10);
      socketRef.current.emit('spawn', { pvePenalty, pvpPenalty, coins: globalCoins });
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

  const handleForge = (newElement: CustomElement, cost: number) => {
    if (socketRef.current) {
      socketRef.current.emit('forge_element', { newElement, cost });
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
    return <Lobby mode="multi" initialCoins={initialCoins} roomCode={currentRoomCode} isHost={isHost} onSpawn={handleSpawn} onExit={onExit} onDeleteServer={handleDeleteServer} />;
  }

  const player = gameState.players[myId];

  return (
    <>
      <Renderer 
        gameState={gameState} 
        myId={myId} 
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
