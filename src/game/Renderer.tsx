import { useEffect, useRef, useState } from 'react';
import { GameState, InputState } from '../shared';
import { ELEMENT_COLORS, getElementColor, getCustomElementEffect, getTileAt, isWall, movePlayer } from '../gameLogic';

const TILE_SIZE = 64;
const TILE_COLORS: Record<string, string> = {
  grass: '#22c55e',
  jungle_grass: '#15803d',
  corruption_grass: '#7e22ce',
  crimson_grass: '#be123c',
  snow: '#f8fafc',
  desert_sand: '#f59e0b',
  hallow_grass: '#f472b6',
  underworld_ash: '#450a0a',
  dirt: '#78350f',
  stone: '#475569',
  wall_stone: '#334155',
  wall_dirt: '#451a03'
};
import VirtualJoystick from '../components/VirtualJoystick';
import { LogOut, Pause, Hammer, Flame, Wallet, Zap } from 'lucide-react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
  size: number;
  effectType?: 'sparkle' | 'trail' | 'pulse' | 'orbit' | 'none';
  angle?: number;
  radius?: number;
}

interface Props {
  gameState: GameState;
  myId: string;
  onInput: (input: InputState) => void;
  onExit: () => void;
  onPause?: () => void;
  onOpenBuilder?: () => void;
  isBuilderOpen?: boolean;
  onOpenForge?: () => void;
  isForgeOpen?: boolean;
}

export default function Renderer({ gameState, myId, onInput, onExit, onPause, onOpenBuilder, isBuilderOpen, onOpenForge, isForgeOpen }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const [isTouch, setIsTouch] = useState(false);
  
  const inputRef = useRef<InputState>({ dx: 0, dy: 0, aimX: 1, aimY: 0, isShooting: false, isUltimate: false });
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  const localPosRef = useRef({ x: 0, y: 0 });
  const lastServerPosRef = useRef({ x: 0, y: 0 });
  const lastHpRef = useRef(100);
  const initializedRef = useRef(false);
  const lastRenderTimeRef = useRef(Date.now());
  const remotePlayersRef = useRef<Record<string, { x: number, y: number, lastX: number, lastY: number, lastUpdate: number }>>({});
  
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const localLastUltRef = useRef(0);
  const serverLastUltRef = useRef<number | undefined>(undefined);
  const shakeRef = useRef(0);
  const lastHpRef = useRef<number | null>(null);

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
  const onInputRef = useRef(onInput);
  useEffect(() => {
    onInputRef.current = onInput;
  }, [onInput]);

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
      
      onInputRef.current({ ...inputRef.current, x: localPosRef.current.x, y: localPosRef.current.y });
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isTouch]);

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
      const now = Date.now();
      const dt = (now - lastRenderTimeRef.current) / 1000;
      lastRenderTimeRef.current = now;

      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      const myPlayer = gameState.players[myId];
      
      // Client-Authoritative Movement
      if (myPlayer) {
        if (!initializedRef.current) {
          localPosRef.current = { x: myPlayer.x, y: myPlayer.y };
          lastServerPosRef.current = { x: myPlayer.x, y: myPlayer.y };
          initializedRef.current = true;
        }
        // We no longer reconcile with server position for the local player
        // to ensure "local movement" as requested.
        // The server will now follow the client's reported position.
        
        // Handle respawn or teleportation (if gameLogic moved us significantly)
        const dist = Math.hypot(myPlayer.x - localPosRef.current.x, myPlayer.y - localPosRef.current.y);
        const isExactlyZero = myPlayer.x === 0 && myPlayer.y === 0;
        if (dist > 100 || isExactlyZero) {
          localPosRef.current.x = myPlayer.x;
          localPosRef.current.y = myPlayer.y;
        }

        // Predict forward
        if (!myPlayer.stunned || myPlayer.stunned <= 0) {
          // Create a temporary player object to use movePlayer
          const tempPlayer = { ...myPlayer, x: localPosRef.current.x, y: localPosRef.current.y };
          movePlayer(gameState, tempPlayer, inputRef.current, dt);
          localPosRef.current.x = tempPlayer.x;
          localPosRef.current.y = tempPlayer.y;
        }
      }

      // Update remote player interpolation data
      Object.values(gameState.players).forEach(p => {
        if (p.id === myId) return;
        if (!remotePlayersRef.current[p.id]) {
          remotePlayersRef.current[p.id] = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, lastUpdate: now };
        } else if (p.x !== remotePlayersRef.current[p.id].x || p.y !== remotePlayersRef.current[p.id].y) {
          remotePlayersRef.current[p.id].lastX = remotePlayersRef.current[p.id].x;
          remotePlayersRef.current[p.id].lastY = remotePlayersRef.current[p.id].y;
          remotePlayersRef.current[p.id].x = p.x;
          remotePlayersRef.current[p.id].y = p.y;
          remotePlayersRef.current[p.id].lastUpdate = now;
        }
      });

      // Screen shake on damage
      if (myPlayer) {
        if (lastHpRef.current !== null && myPlayer.hp < lastHpRef.current) {
          shakeRef.current = Math.min(20, shakeRef.current + (lastHpRef.current - myPlayer.hp) * 2);
        }
        lastHpRef.current = myPlayer.hp;
      }
      
      const shakeX = (Math.random() - 0.5) * shakeRef.current;
      const shakeY = (Math.random() - 0.5) * shakeRef.current;
      shakeRef.current *= 0.9;

      const camX = myPlayer ? localPosRef.current.x - canvas.width / 2 : 0;
      const camY = myPlayer ? localPosRef.current.y - canvas.height / 2 : 0;

      ctx.fillStyle = '#0f172a'; // slate-900
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.translate(-camX + shakeX, -camY + shakeY);

      // Terraria-style Tiled Background
      const startTX = Math.floor(camX / TILE_SIZE);
      const startTY = Math.floor(camY / TILE_SIZE);
      const endTX = Math.ceil((camX + canvas.width) / TILE_SIZE);
      const endTY = Math.ceil((camY + canvas.height) / TILE_SIZE);

      for (let tx = startTX; tx <= endTX; tx++) {
        for (let ty = startTY; ty <= endTY; ty++) {
          const tileKey = `${tx},${ty}`;
          const tileType = gameState.tiles?.[tileKey] || getTileAt(gameState, tx, ty);
          const color = TILE_COLORS[tileType] || '#0f172a';
          
          ctx.fillStyle = color;
          ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

          // Tile borders for "blocky" look
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);

          // Wall details
          if (isWall(tileType)) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.fillRect(tx * TILE_SIZE + 5, ty * TILE_SIZE + 5, TILE_SIZE - 10, TILE_SIZE - 10);
            
            // Cracks for stone walls
            if (tileType === 'wall_stone') {
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
              ctx.beginPath();
              ctx.moveTo(tx * TILE_SIZE + 10, ty * TILE_SIZE + 10);
              ctx.lineTo(tx * TILE_SIZE + 30, ty * TILE_SIZE + 40);
              ctx.stroke();
            }
          } else {
            // Decorations for non-walls
            const noise = (x: number, y: number, s: number) => {
              const v = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
              return v - Math.floor(v);
            };
            const decNoise = noise(tx, ty, 999);
            if (decNoise < 0.15) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
              if (tileType.includes('grass')) {
                // Grass tufts
                ctx.fillRect(tx * TILE_SIZE + 20, ty * TILE_SIZE + 40, 24, 4);
                ctx.fillRect(tx * TILE_SIZE + 25, ty * TILE_SIZE + 35, 14, 4);
              } else if (tileType === 'stone' || tileType === 'dirt') {
                // Pebbles
                ctx.beginPath();
                ctx.arc(tx * TILE_SIZE + 32, ty * TILE_SIZE + 32, 6, 0, Math.PI * 2);
                ctx.fill();
              } else if (tileType === 'snow') {
                // Snow clumps
                ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.beginPath();
                ctx.arc(tx * TILE_SIZE + 40, ty * TILE_SIZE + 20, 10, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }
      }

      // Grid (optional, faint for tactical feel)
      const gridSize = 256;
      const startX = Math.floor(camX / gridSize) * gridSize;
      const startY = Math.floor(camY / gridSize) * gridSize;

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
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

      // Impact Decals
      if (gameState.impactDecals) {
        Object.values(gameState.impactDecals).forEach(d => {
          ctx.globalAlpha = (d.life / d.maxLife) * 0.5;
          ctx.fillStyle = d.color;
          if (d.type === 'scorch') {
            ctx.beginPath();
            ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
            ctx.fill();
          } else if (d.type === 'ice') {
            ctx.fillRect(d.x - d.size/2, d.y - d.size/2, d.size, d.size);
          } else {
            ctx.beginPath();
            ctx.moveTo(d.x - d.size, d.y);
            ctx.lineTo(d.x + d.size, d.y);
            ctx.moveTo(d.x, d.y - d.size);
            ctx.lineTo(d.x, d.y + d.size);
            ctx.strokeStyle = d.color;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
          ctx.globalAlpha = 1.0;
        });
      }

      // Hazards
      if (gameState.hazards) {
        Object.values(gameState.hazards).forEach(h => {
          const gradient = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, h.radius);
          if (h.type === 'lava') {
            gradient.addColorStop(0, 'rgba(239, 68, 68, 0.6)');
            gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
          } else if (h.type === 'blizzard') {
            gradient.addColorStop(0, 'rgba(96, 165, 250, 0.4)');
            gradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
          } else if (h.type === 'vines') {
            gradient.addColorStop(0, 'rgba(34, 197, 94, 0.4)');
            gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
          } else if (h.type === 'spikes') {
            gradient.addColorStop(0, 'rgba(148, 163, 184, 0.6)');
            gradient.addColorStop(1, 'rgba(148, 163, 184, 0)');
          }
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
          ctx.fill();

          if (h.type === 'spikes') {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            for (let i = 0; i < 8; i++) {
              const angle = (i / 8) * Math.PI * 2 + (Date.now() / 1000);
              ctx.beginPath();
              ctx.moveTo(h.x + Math.cos(angle) * (h.radius * 0.2), h.y + Math.sin(angle) * (h.radius * 0.2));
              ctx.lineTo(h.x + Math.cos(angle) * h.radius, h.y + Math.sin(angle) * h.radius);
              ctx.stroke();
            }
          }
        });
      }

      // Particle system
      if (particlesRef.current.length > 500) particlesRef.current.shift();
      particlesRef.current.forEach((p, i) => {
        if (p.effectType === 'orbit') {
          p.angle = (p.angle || 0) + 0.1;
          const r = p.radius || 30;
          // Orbit particles stay relative to their origin, but here we just make them move in circles
          p.x += Math.cos(p.angle) * 2;
          p.y += Math.sin(p.angle) * 2;
        } else if (p.effectType === 'pulse') {
          p.size *= 1.05;
          p.life -= 0.05;
        } else if (p.effectType === 'sparkle') {
          p.vx += (Math.random() - 0.5) * 0.5;
          p.vy += (Math.random() - 0.5) * 0.5;
          p.size *= 0.95;
        }
        
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.1;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.beginPath();
          if (p.effectType === 'sparkle') {
            // Draw a star shape or diamond for sparkle
            const s = p.size;
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s/2, p.y);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s/2, p.y);
            ctx.closePath();
          } else {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          }
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

      // Bosses
      if (gameState.bosses) {
        Object.values(gameState.bosses).forEach(b => {
          if (!b) return;
          
          ctx.fillStyle = '#8b5cf6';
          ctx.shadowColor = '#8b5cf6';
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - 60);
          ctx.lineTo(b.x + 50, b.y + 30);
          ctx.lineTo(b.x - 50, b.y + 30);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;

          // Boss Shield
          if (b.shieldHp > 0) {
            ctx.strokeStyle = getElementColor(gameState, b.shieldElement);
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 90, 0, Math.PI * 2);
            ctx.stroke();
            
            // Shield HP
            const shieldPct = b.shieldHp / b.maxShieldHp;
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 90, -Math.PI/2, -Math.PI/2 + (Math.PI * 2 * shieldPct));
            ctx.stroke();
          }

          // Boss Name & HP Bar
          const hpPercent = b.hp / b.maxHp;
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.name || 'Elemental Titan', b.x, b.y - 85);

          ctx.fillStyle = '#ef4444';
          ctx.fillRect(b.x - 30, b.y - 70, 60, 6);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(b.x - 30, b.y - 70, 60 * hpPercent, 6);
        });
      }

      // Enemies
      if (gameState.enemies) {
        Object.values(gameState.enemies).forEach(enemy => {
          if (!enemy) return;
          
          if (enemy.type === 'void_creature') {
            ctx.fillStyle = '#8b5cf6'; // violet-500
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = getElementColor(gameState, enemy.element);
            ctx.beginPath();
            ctx.rect(enemy.x - 15, enemy.y - 15, 30, 30);
            ctx.fill();
          }

          // Enemy Name & HP Bar
          const hpPercent = enemy.hp / enemy.maxHp;
          
          ctx.fillStyle = 'white';
          ctx.font = 'bold 12px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(enemy.name || (enemy.type === 'void_creature' ? 'Void Stalker' : 'Alchemist Bot'), enemy.x, enemy.y - 35);

          ctx.fillStyle = '#ef4444';
          ctx.fillRect(enemy.x - 15, enemy.y - 25, 30, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(enemy.x - 15, enemy.y - 25, 30 * hpPercent, 4);
        });
      }

      // Projectiles
      if (gameState.projectiles) {
        Object.values(gameState.projectiles).forEach(p => {
          if (!p) return;
          ctx.fillStyle = getElementColor(gameState, p.element);
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 15;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6 + (p.damage / 10), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Trail
          const effectType = getCustomElementEffect(gameState, p.element);
          particlesRef.current.push({
            x: p.x,
            y: p.y,
            vx: -p.vx * 0.1,
            vy: -p.vy * 0.1,
            color: ctx.fillStyle as string,
            life: 1,
            size: effectType === 'pulse' ? 4 : 2,
            effectType: effectType === 'none' ? 'trail' : effectType
          });
        });
      }

      // Players
      if (gameState.players) {
        Object.values(gameState.players).forEach(p => {
          if (!p) return;
          
          // Dynamic color based on element
          const element = p.loadout.attack || 'fire';
          const color = getElementColor(gameState, element);
          const effectType = getCustomElementEffect(gameState, element);
          
          // Aura
          if (p.aura) {
            ctx.strokeStyle = p.aura;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.shadowColor = color;
          ctx.shadowBlur = 20;
          ctx.fillStyle = color;
          ctx.beginPath();
          
          let drawX = p.x;
          let drawY = p.y;
          
          if (p.id === myId) {
            drawX = localPosRef.current.x;
            drawY = localPosRef.current.y;
          } else {
            // Interpolate remote player
            const remote = remotePlayersRef.current[p.id];
            if (remote) {
              const lerpFactor = Math.min(1, (now - remote.lastUpdate) / (1000 / 60));
              drawX = remote.lastX + (remote.x - remote.lastX) * lerpFactor;
              drawY = remote.lastY + (remote.y - remote.lastY) * lerpFactor;
            }
          }

          ctx.arc(drawX, drawY, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          
          // Particle emission (Prestige Trails)
          const trailChance = p.coins > 10000 ? 0.8 : p.coins > 5000 ? 0.5 : 0.2;
          if (Math.random() < trailChance) {
            particlesRef.current.push({
              x: drawX,
              y: drawY,
              vx: (Math.random() - 0.5) * 1,
              vy: (Math.random() - 0.5) * 1,
              color: p.coins > 10000 ? '#facc15' : color,
              life: 0.8,
              size: p.coins > 10000 ? Math.random() * 4 + 2 : Math.random() * 2 + 1,
              effectType: p.coins > 10000 ? 'sparkle' : 'trail',
              angle: Math.random() * Math.PI * 2,
              radius: Math.random() * 20 + 10
            });
          }
          
          if (p.id === myId) {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3;
            ctx.stroke();
          }

          // Stun indicator
          if (p.stunned && p.stunned > 0) {
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(drawX, drawY - 45, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#facc15';
            ctx.beginPath();
            ctx.arc(drawX + Math.cos(Date.now()/100)*10, drawY - 45 + Math.sin(Date.now()/100)*10, 3, 0, Math.PI * 2);
            ctx.fill();
          }

          // HP Bar
          if (p.hp !== undefined && p.maxHp !== undefined) {
            const hpPercent = Math.max(0, p.hp / p.maxHp);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(drawX - 25, drawY - 35, 50, 6);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(drawX - 25, drawY - 35, 50 * hpPercent, 6);
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

      // Minimap
      const mapSize = isTouch ? 100 : 150;
      const mapPadding = isTouch ? 10 : 20;
      const mapX = canvas.width - mapSize - mapPadding;
      const mapY = isTouch ? mapPadding + 60 : mapPadding; // Move down on mobile to avoid potential status bar/notches
      
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(mapX, mapY, mapSize, mapSize, 10);
      ctx.fill();
      ctx.stroke();

      if (myPlayer) {
        const scale = isTouch ? 0.04 : 0.05;
        const centerX = mapX + mapSize / 2;
        const centerY = mapY + mapSize / 2;

        // Draw players on minimap
        Object.values(gameState.players).forEach(p => {
          let drawX = p.x;
          let drawY = p.y;
          
          if (p.id === myId) {
            drawX = localPosRef.current.x;
            drawY = localPosRef.current.y;
          } else {
            const remote = remotePlayersRef.current[p.id];
            if (remote) {
              const lerpFactor = Math.min(1, (now - remote.lastUpdate) / (1000 / 60));
              drawX = remote.lastX + (remote.x - remote.lastX) * lerpFactor;
              drawY = remote.lastY + (remote.y - remote.lastY) * lerpFactor;
            }
          }

          const relX = (drawX - localPosRef.current.x) * scale;
          const relY = (drawY - localPosRef.current.y) * scale;
          if (Math.abs(relX) < mapSize/2 && Math.abs(relY) < mapSize/2) {
            ctx.fillStyle = p.id === myId ? 'white' : '#ef4444';
            ctx.beginPath();
            ctx.arc(centerX + relX, centerY + relY, isTouch ? 2.5 : 3, 0, Math.PI * 2);
            ctx.fill();
          }
        });

        // Draw enemies on minimap
        if (gameState.enemies) {
          Object.values(gameState.enemies).forEach(e => {
            const relX = (e.x - localPosRef.current.x) * scale;
            const relY = (e.y - localPosRef.current.y) * scale;
            if (Math.abs(relX) < mapSize/2 && Math.abs(relY) < mapSize/2) {
              ctx.fillStyle = '#8b5cf6'; // violet-500 for enemies
              ctx.beginPath();
              ctx.arc(centerX + relX, centerY + relY, isTouch ? 1.5 : 2, 0, Math.PI * 2);
              ctx.fill();
            }
          });
        }

        // Draw bosses on minimap
        if (gameState.bosses) {
          Object.values(gameState.bosses).forEach(b => {
            const relX = (b.x - localPosRef.current.x) * scale;
            const relY = (b.y - localPosRef.current.y) * scale;
            if (Math.abs(relX) < mapSize/2 && Math.abs(relY) < mapSize/2) {
              ctx.fillStyle = '#facc15';
              ctx.beginPath();
              ctx.arc(centerX + relX, centerY + relY, isTouch ? 3 : 5, 0, Math.PI * 2);
              ctx.fill();
              // Pulsing ring
              ctx.strokeStyle = '#facc15';
              ctx.lineWidth = 1;
              ctx.beginPath();
              ctx.arc(centerX + relX, centerY + relY, (isTouch ? 3 : 5) + (Math.sin(Date.now() / 200) * 3 + 3), 0, Math.PI * 2);
              ctx.stroke();
            }
          });
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState, myId]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-slate-900">
      <canvas ref={canvasRef} className="absolute inset-0 block" />
      
      {/* UI Overlay */}
      <div className={`absolute top-2 left-2 md:top-4 md:left-4 z-[100] flex flex-col gap-3 ${isTouch ? 'max-w-[80%]' : ''}`}>
        <div className="flex flex-wrap gap-2 md:gap-3">
          <button 
            onPointerDown={(e) => {
              e.stopPropagation();
              onExit();
            }}
            className="p-3 md:px-5 md:py-3 bg-slate-800/90 backdrop-blur text-white rounded-xl hover:bg-slate-700 pointer-events-auto border border-slate-600 shadow-xl cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
            title="Exit to Menu"
          >
            <LogOut size={isTouch ? 20 : 22} />
            <span className="hidden md:inline text-lg">Exit</span>
          </button>
          
          {onPause && (
            <button 
              onPointerDown={(e) => {
                e.stopPropagation();
                onPause();
              }}
              className="p-3 md:px-5 md:py-3 bg-slate-800/90 backdrop-blur text-white rounded-xl hover:bg-slate-700 pointer-events-auto border border-slate-600 shadow-xl cursor-pointer flex items-center gap-2 transition-transform active:scale-95"
              title="Pause"
            >
              <Pause size={isTouch ? 20 : 22} />
              <span className="hidden md:inline text-lg">Pause</span>
            </button>
          )}
          
          {onOpenBuilder && (
            <button 
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenBuilder();
              }}
              className="p-3 md:px-5 md:py-3 bg-blue-600/90 backdrop-blur text-white rounded-xl hover:bg-blue-500 pointer-events-auto border border-blue-500 shadow-xl cursor-pointer flex items-center gap-2 font-bold transition-transform active:scale-95"
              title="Builder"
            >
              <Hammer size={isTouch ? 20 : 22} />
              <span className="hidden md:inline text-lg">Builder</span>
            </button>
          )}
          {onOpenForge && (
            <button 
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenForge();
              }}
              className="p-3 md:px-5 md:py-3 bg-purple-600/90 backdrop-blur text-white rounded-xl hover:bg-purple-500 pointer-events-auto border border-purple-500 shadow-xl cursor-pointer flex items-center gap-2 font-bold transition-transform active:scale-95"
              title="Forge"
            >
              <Flame size={isTouch ? 20 : 22} />
              <span className="hidden md:inline text-lg">Forge</span>
            </button>
          )}
        </div>

        {gameState.players[myId] && (
          <div className="bg-slate-800/90 backdrop-blur border border-slate-600 rounded-xl p-3 md:p-4 text-white shadow-xl pointer-events-none w-fit">
            <div className="flex items-center gap-3">
              <Wallet size={isTouch ? 18 : 20} className="text-yellow-400" />
              <div className="text-xl md:text-3xl font-black text-yellow-400">
                {gameState.players[myId].coins} <span className="text-xs md:text-base font-normal text-slate-400">Coins</span>
              </div>
            </div>
            {!isTouch && (
              <div className="flex gap-4 text-xs mt-1">
                <div>
                  <span className="text-slate-400">PvE Drop:</span> <span className="text-orange-400 font-bold">{gameState.players[myId].pvePenalty}%</span>
                </div>
                {gameState.players[myId].pvpPenalty > 0 && (
                  <div>
                    <span className="text-slate-400">PvP Drop:</span> <span className="text-red-400 font-bold">{gameState.players[myId].pvpPenalty}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Desktop Ultimate Indicator */}
        {!isTouch && gameState.players[myId]?.loadout.ultimate && (
          <div className="bg-slate-800/80 backdrop-blur border border-slate-600 rounded-lg p-3 text-white shadow-lg pointer-events-none relative overflow-hidden w-fit">
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
