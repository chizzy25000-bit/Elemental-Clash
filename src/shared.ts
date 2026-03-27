export type ElementType = 'fire' | 'water' | 'earth' | 'air' | string;

export const getCoinsKey = (uid?: string) => uid ? `elemental_clash_coins_${uid}` : 'elemental_clash_global_coins';
export const getInventoryKey = (uid?: string) => uid ? `elemental_clash_inventory_${uid}` : 'elemental_clash_cloud_inventory';
export const getLoadoutKey = (uid?: string) => uid ? `elemental_clash_loadout_${uid}` : 'elemental_clash_cloud_loadout';
export const getCustomElementsKey = (uid?: string) => uid ? `elemental_clash_custom_elements_${uid}` : 'elemental_clash_cloud_custom_elements';

export interface StatusEffect {
  type: 'burning' | 'poisoned' | 'slowed' | 'stunned';
  duration: number; // frames
}

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
  vx: number;
  vy: number;
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
  statusEffects: StatusEffect[];
  isDead?: boolean;
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
  statusEffects: StatusEffect[];
  abilityCooldown?: number;
  lastAbility?: number;
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

export type HazardType = 'lava' | 'blizzard' | 'vines' | 'spikes' | 'black_hole';

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
  lastAbility?: number;
  abilityCooldown: number;
  attackPattern: number;
}

export interface ImpactDecal {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  type: 'scorch' | 'ice' | 'impact' | 'poison' | 'void';
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
}
