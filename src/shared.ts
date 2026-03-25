export type ElementType = 'fire' | 'water' | 'earth' | 'air' | string;

export interface CustomElement {
  id: string;
  name: string;
  color: string;
  tier: number;
  baseType: 'fire' | 'water' | 'earth' | 'air' | 'void';
  themeDescription: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
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
  lastUltimate?: number;
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

export interface GameState {
  players: Record<string, Player>;
  projectiles: Record<string, Projectile>;
  enemies: Record<string, Enemy>;
  lootOrbs: Record<string, LootOrb>;
  floatingTexts: Record<string, FloatingText>;
  customElements: Record<string, CustomElement>;
}

export interface InputState {
  dx: number;
  dy: number;
  aimX: number;
  aimY: number;
  isShooting: boolean;
  isUltimate?: boolean;
}
