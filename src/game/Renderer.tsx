import { useEffect, useRef, useState } from 'react';
import { GameState, InputState } from '../shared';
import { ELEMENT_COLORS } from '../gameLogic';
import VirtualJoystick from '../components/VirtualJoystick';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
}

interface Props {
  gameState: GameState;
  myId: string;
  onInput: (input: InputState) => void;
  onExit: () => void;
  onOpenBuilder?: () => void;
  isBuilderOpen?: boolean;
  onOpenForge?: () => void;
  isForgeOpen?: boolean;
}

export default function Renderer({ gameState, myId, onInput, onExit, onOpenBuilder, isBuilderOpen, onOpenForge, isForgeOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [isTouch, setIsTouch] = useState(false);
  
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, aimX: 0, aimY: 0, isShooting: false, isUltimate: false });
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const localLastUltRef = useRef(0);
  const serverLastUltRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Sync ultimate cooldown
  useEffect(() => {
    const myPlayer = gameState.players[myId];
    if (myPlayer && myPlayer.lastUltimate !== serverLastUltRef.current) {
      const isInitial = serverLastUltRef.current === undefined;
      serverLastUltRef.current = myPlayer.lastUltimate;
      
      if (!isInitial) {
        localLastUltRef.current = Date.now();
      } else if (myPlayer.lastUltimate) {
        // On initial load, only show cooldown if it's very recent (e.g. within 5 seconds)
        // This prevents showing a full cooldown when loading an old save
        const elapsedSinceUlt = Date.now() - myPlayer.lastUltimate;
        if (elapsedSinceUlt < 5000 && elapsedSinceUlt > -5000) {
          localLastUltRef.current = Date.now() - elapsedSinceUlt;
        } else {
          localLastUltRef.current = 0;
        }
      }
    }
  }, [gameState.players, myId]);

  // Cooldown animation loop
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      const now = Date.now();
      const elapsed = now - localLastUltRef.current;
      if (elapsed < 5000) {
        setCooldownProgress(1 - (elapsed / 5000));
      } else {
        setCooldownProgress(0);
      }
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  // Input handling loop
  useEffect(() => {
    let animationFrameId: number;
    const loop = () => {
      if (!isTouch) {
        // Desktop movement
        let dx = 0; let dy = 0;
        if (keysRef.current['w']) dy -= 1;
        if (keysRef.current['s']) dy += 1;
        if (keysRef.current['a']) dx -= 1;
        if (keysRef.current['d']) dx += 1;
        
        // Normalize
        const mag = Math.sqrt(dx*dx + dy*dy);
        if (mag > 0) { dx /= mag; dy /= mag; }
        
        inputRef.current.dx = dx;
        inputRef.current.dy = dy;
      }
      
      onInput({ ...inputRef.current });
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isTouch, onInput]);

  // Event listeners for desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keysRef.current[e.key.toLowerCase()] = true; 
      if (e.key.toLowerCase() === 'e') inputRef.current.isUltimate = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      keysRef.current[e.key.toLowerCase()] = false; 
      if (e.key.toLowerCase() === 'e') {
        setTimeout(() => {
          inputRef.current.isUltimate = false;
        }, 100);
      }
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      let dx = mx - cx;
      let dy = my - cy;
      const mag = Math.sqrt(dx*dx + dy*dy);
      if (mag > 0) { dx /= mag; dy /= mag; }
      
      inputRef.current.aimX = dx;
      inputRef.current.aimY = dy;
    };
    
    const handleMouseDown = (e: MouseEvent) => { 
      if ((e.target as HTMLElement).closest('button')) return;
      inputRef.current.isShooting = true; 
    };
    const handleMouseUp = () => { inputRef.current.isShooting = false; };

    const handleBlur = () => {
      keysRef.current = {};
      inputRef.current.isShooting = false;
      inputRef.current.isUltimate = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const myPlayer = gameState.players[myId];
      const camX = myPlayer ? myPlayer.x - canvas.width / 2 : 0;
      const camY = myPlayer ? myPlayer.y - canvas.height / 2 : 0;

      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-camX, -camY);

      // Grid
      const gridSize = 50;
      const startX = Math.floor(camX / gridSize) * gridSize;
      const startY = Math.floor(camY / gridSize) * gridSize;

      ctx.strokeStyle = '#1e293b'; // slate-800
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x < camX + canvas.width; x += gridSize) {
        ctx.moveTo(x, camY);
        ctx.lineTo(x, camY + canvas.height);
      }
      for (let y = startY; y < camY + canvas.height; y += gridSize) {
        ctx.moveTo(camX, y);
        ctx.lineTo(camX + canvas.width, y);
      }
      ctx.stroke();

      // Cyberpunk Ad Banners
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(100, 100, 200, 50);
      ctx.strokeStyle = '#06b6d4'; // cyan-500
      ctx.lineWidth = 2;
      ctx.strokeRect(100, 100, 200, 50);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 14px Inter, sans-serif';
      ctx.fillText('CYBER-AD: UPGRADE NOW', 120, 130);

      // Particle system
      particlesRef.current.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        }
      });

      // Loot Orbs
      if (gameState.lootOrbs) {
        Object.values(gameState.lootOrbs).forEach(orb => {
          ctx.fillStyle = '#eab308'; // yellow-500
          ctx.beginPath();
          ctx.arc(orb.x, orb.y, 8, 0, Math.PI * 2);
          ctx.fill();
          
          // Glow
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        });
      }

      // Enemies
      if (gameState.enemies) {
        Object.values(gameState.enemies).forEach(enemy => {
          if (enemy.type === 'void_creature') {
            ctx.fillStyle = '#8b5cf6'; // violet-500
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = enemy.element ? ELEMENT_COLORS[enemy.element] : '#64748b';
            ctx.beginPath();
            ctx.rect(enemy.x - 15, enemy.y - 15, 30, 30);
            ctx.fill();
          }

          // HP Bar
          const hpPercent = enemy.hp / enemy.maxHp;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(enemy.x - 20, enemy.y - 25, 40, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(enemy.x - 20, enemy.y - 25, 40 * hpPercent, 4);
        });
      }

      // Projectiles
      if (gameState.projectiles) {
        Object.values(gameState.projectiles).forEach(p => {
          ctx.fillStyle = p.element ? ELEMENT_COLORS[p.element] : '#ef4444';
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6 + (p.damage / 10), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Trail
          particlesRef.current.push({
            x: p.x,
            y: p.y,
            vx: -p.vx * 0.1,
            vy: -p.vy * 0.1,
            color: ctx.fillStyle as string,
            life: 1,
            size: 2
          });
        });
      }

      // Players
      if (gameState.players) {
        Object.values(gameState.players).forEach(p => {
          if (!p) return;
          
          // Dynamic color based on element
          const element = p.loadout.attack || 'fire';
          const color = ELEMENT_COLORS[element] || p.color;
          
          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x || 0, p.y || 0, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Particle emission
          if (Math.random() > 0.5) {
            particlesRef.current.push({
              x: p.x,
              y: p.y,
              vx: (Math.random() - 0.5) * 2,
              vy: (Math.random() - 0.5) * 2,
              color: color,
              life: 1,
              size: 3
            });
          }
          
          if (p.id === myId) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          // HP Bar
          if (p.hp !== undefined && p.maxHp !== undefined) {
            const hpPercent = Math.max(0, p.hp / p.maxHp);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(p.x - 25, p.y - 35, 50, 6);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(p.x - 25, p.y - 35, 50 * hpPercent, 6);
          }
        });
      }

      // Floating Texts
      if (gameState.floatingTexts) {
        Object.values(gameState.floatingTexts).forEach(text => {
          ctx.font = 'bold 16px Inter, sans-serif';
          ctx.fillStyle = text.color;
          ctx.textAlign = 'center';
          ctx.globalAlpha = text.life / text.maxLife;
          ctx.fillText(text.text, text.x, text.y);
          ctx.globalAlpha = 1.0;
        });
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, myId]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900">
      <canvas ref={canvasRef} className="absolute inset-0 block" />
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-[100] flex flex-col gap-2">
        <div className="flex gap-2">
          <button 
            onPointerDown={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="px-4 py-2 bg-slate-800/80 backdrop-blur text-white rounded-lg hover:bg-slate-700 pointer-events-auto border border-slate-600 shadow-lg cursor-pointer w-fit"
          >
            Exit to Menu
          </button>
          
          {onOpenBuilder && (
            <button 
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenBuilder();
              }}
              className="px-4 py-2 bg-blue-600/80 backdrop-blur text-white rounded-lg hover:bg-blue-500 pointer-events-auto border border-blue-500 shadow-lg cursor-pointer w-fit font-bold"
            >
              Builder
            </button>
          )}
          {onOpenForge && (
            <button 
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenForge();
              }}
              className="px-4 py-2 bg-purple-600/80 backdrop-blur text-white rounded-lg hover:bg-purple-500 pointer-events-auto border border-purple-500 shadow-lg cursor-pointer w-fit font-bold"
            >
              Forge
            </button>
          )}
          {/* Desktop Ultimate Indicator */}
          {!isTouch && gameState.players[myId]?.loadout.ultimate && (
            <div className="mt-4 bg-slate-800/80 backdrop-blur border border-slate-600 rounded-lg p-3 text-white shadow-lg pointer-events-none relative overflow-hidden">
              <div className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Ultimate [E]</div>
              <div className="text-lg font-black text-purple-400 relative z-10">
                {cooldownProgress > 0 ? `${Math.ceil(cooldownProgress * 5)}s` : 'READY'}
              </div>
              {cooldownProgress > 0 && (
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-purple-500 transition-all duration-75"
                  style={{ width: `${cooldownProgress * 100}%` }}
                />
              )}
            </div>
          )}
        </div>

        {gameState.players[myId] && (
          <div className="bg-slate-800/80 backdrop-blur border border-slate-600 rounded-lg p-3 text-white shadow-lg pointer-events-none">
            <div className="text-sm text-slate-400 font-bold uppercase tracking-wider mb-1">Balance</div>
            <div className="text-2xl font-black text-yellow-400 mb-2">
              {gameState.players[myId].coins} <span className="text-sm">Coins</span>
            </div>
            <div className="flex gap-4 text-xs">
              <div>
                <span className="text-slate-400">PvE Drop:</span> <span className="text-orange-400 font-bold">{gameState.players[myId].pvePenalty}%</span>
              </div>
              {gameState.players[myId].pvpPenalty > 0 && (
                <div>
                  <span className="text-slate-400">PvP Drop:</span> <span className="text-red-400 font-bold">{gameState.players[myId].pvpPenalty}%</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Controls */}
      {isTouch && !isBuilderOpen && !isForgeOpen && (
        <>
          <VirtualJoystick side="left" onChange={({x, y}) => {
            inputRef.current.dx = x;
            inputRef.current.dy = y;
          }} />
          <VirtualJoystick side="right" onChange={({x, y, active}) => {
            if (active) {
              // Normalize aim vector
              const mag = Math.sqrt(x*x + y*y);
              if (mag > 0) {
                inputRef.current.aimX = x / mag;
                inputRef.current.aimY = y / mag;
              }
            }
            inputRef.current.isShooting = active;
          }} />
          
          {gameState.players[myId]?.loadout.ultimate && (
            <button
              onPointerDown={() => inputRef.current.isUltimate = true}
              onPointerUp={() => {
                setTimeout(() => { inputRef.current.isUltimate = false; }, 100);
              }}
              onPointerLeave={() => {
                setTimeout(() => { inputRef.current.isUltimate = false; }, 100);
              }}
              className={`absolute bottom-32 right-32 w-16 h-16 rounded-full border-2 text-white font-bold shadow-lg flex items-center justify-center z-[100] transition-all select-none overflow-hidden ${
                cooldownProgress > 0 
                  ? 'bg-slate-700 border-slate-500 opacity-70 cursor-not-allowed' 
                  : 'bg-purple-600/80 border-purple-400 active:bg-purple-500 active:scale-95'
              }`}
            >
              <span className="relative z-10">{cooldownProgress > 0 ? Math.ceil(cooldownProgress * 5) : 'ULT'}</span>
              {cooldownProgress > 0 && (
                <div 
                  className="absolute bottom-0 left-0 w-full bg-slate-900/50"
                  style={{ height: `${cooldownProgress * 100}%` }}
                />
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}
