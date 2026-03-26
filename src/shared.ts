export type ElementType = 'fire' | 'water' | 'earth' | 'air' | string;

export interface CustomElement {
  id: string;
  name: string;
  color: string;
  tier: number;
  baseType: 'fire' | 'water' | 'earth' | 'air' | 'void';
  themeDescription: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  effectType: 'sparkle' | 'trail' | 'pulse' | 'orbit' | 'none';
}

export interface Loadout {
  attack: ElementType | null;
  defense: ElementType | null;
  mobility: ElementType | null;
  healing: ElementType | null;
  ultimate: ElementType | null;
}

export interface Player {
  id: string;
  displayName?: string;
  x: number;
  y: number;
  color: string;
  speed: number;
  coins: number;
  pvePenalty: number;
  pvpPenalty: number;
  inventory: ElementType[];
  loadout: Loadout;
  hp: number;
  maxHp: number;
  stunned?: number; // frames remaining
  lastUltimate?: number;
  aura?: string; // Color of the aura
  trailType?: 'sparkle' | 'trail' | 'pulse' | 'orbit' | 'none';
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  life: number;
  element: ElementType | 'void';
  damage: number;
  effectType?: 'sparkle' | 'trail' | 'pulse' | 'orbit' | 'none';
}

export interface EnemyIntent {
  dx: number;
  dy: number;
  action: string;
  timestamp: number;
}

export interface Enemy {
  id: string;
  x: number;
  y: number;
  type: 'void_creature' | 'alchemist_bot';
  hp: number;
  maxHp: number;
  speed: number;
  element?: ElementType; // Bots might have an element
  coinsToDrop: number;
  vx: number;
  vy: number;
  lastShot?: number;
  intent?: EnemyIntent;
  name?: string;
}

export interface LootOrb {
  id: string;
  x: number;
  y: number;
  coins: number;
  life: number; // Disappears after some time
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export type HazardType = 'lava' | 'blizzard' | 'vines' | 'spikes';

export interface Hazard {
  id: string;
  x: number;
  y: number;
  type: HazardType;
  radius: number;
  life: number;
  maxLife: number;
}

export interface Boss extends Enemy {
  isBoss: true;
  name: string;
  phase: number;
  shieldElement?: ElementType;
  shieldHp: number;
  maxShieldHp: number;
  lastAbility?: string;
  abilityCooldown: number;
}

export interface ImpactDecal {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: 'scorch' | 'ice' | 'impact';
}

export interface GameState {
  players: Record<string, Player>;
  projectiles: Record<string, Projectile>;
  enemies: Record<string, Enemy>;
  lootOrbs: Record<string, LootOrb>;
  floatingTexts: Record<string, FloatingText>;
  customElements: Record<string, CustomElement>;
  hazards: Record<string, Hazard>;
  bosses: Record<string, Boss>;
  impactDecals: Record<string, ImpactDecal>;
  tiles: Record<string, string>; // "x,y" -> tileType
}

export interface InputState {
  dx: number;
  dy: number;
  aimX: number;
  aimY: number;
  isShooting: boolean;
  isUltimate?: boolean;
  x?: number;
  y?: number;
  hp?: number;
  coins?: number;
}
