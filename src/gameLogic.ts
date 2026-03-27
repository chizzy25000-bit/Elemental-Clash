import { GameState, InputState, ElementType, Projectile, Enemy, LootOrb, FloatingText, Player, CustomElement, HazardType, StatusEffect } from './shared';

export const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444',
  water: '#3b82f6',
  earth: '#10b981',
  air: '#cbd5e1',
  void: '#8b5cf6'
};

export function getBaseType(state: GameState, elementId: string | null | undefined): 'fire' | 'water' | 'earth' | 'air' | 'void' {
  if (!elementId) return 'void';
  if (['fire', 'water', 'earth', 'air', 'void'].includes(elementId)) return elementId as any;
  return state.customElements?.[elementId]?.baseType || 'void';
}

export function getElementColor(state: GameState, elementId: string | null | undefined): string {
  if (!elementId) return '#ffffff';
  if (ELEMENT_COLORS[elementId]) return ELEMENT_COLORS[elementId];
  return state.customElements?.[elementId]?.color || '#ffffff';
}

export function getElementTier(state: GameState, elementId: string | null | undefined): number {
  if (!elementId || elementId === 'void') return 1;
  if (['fire', 'water', 'earth', 'air'].includes(elementId)) return 1;
  return state.customElements?.[elementId]?.tier || 1;
}

export function getCustomElementEffect(state: GameState, elementId: string | null | undefined): 'sparkle' | 'trail' | 'pulse' | 'orbit' | 'none' {
  if (!elementId || !state.customElements?.[elementId]) return 'none';
  return state.customElements[elementId].effectType || 'none';
}

export function getEvolutionCost(tier: number): number {
  // Evolution is 40% of the cost of forging a new element of that tier
  const forgeCost = Math.min(15000, Math.floor(500 * Math.pow(1.5, tier)));
  return Math.floor(forgeCost * 0.4);
}

function processStatusEffects(entity: { hp: number, maxHp: number, speed: number, statusEffects: StatusEffect[] }, dt: number, state: GameState, x: number, y: number) {
  if (!entity.statusEffects) entity.statusEffects = [];
  entity.statusEffects = entity.statusEffects.filter(effect => {
    effect.duration -= dt * 60;
    if (effect.duration <= 0) return false;

    if (effect.type === 'burning') {
      entity.hp -= 0.5 * dt * 60;
      if (Math.random() < 0.1 * dt * 60) addFloatingText(state, x, y, 'BURN', '#ef4444');
    } else if (effect.type === 'poisoned') {
      entity.hp -= 0.2 * dt * 60;
      if (Math.random() < 0.1 * dt * 60) addFloatingText(state, x, y, 'POISON', '#22c55e');
    } else if (effect.type === 'slowed') {
      entity.speed *= 0.5;
    } else if (effect.type === 'stunned') {
      entity.speed = 0;
    }
    return true;
  });
}

function getDecalType(state: GameState, element: ElementType | 'void'): 'scorch' | 'ice' | 'impact' | 'poison' | 'void' {
  const baseType = getBaseType(state, element);
  if (baseType === 'fire') return 'scorch';
  if (baseType === 'water') return 'ice';
  if (baseType === 'earth') return 'impact';
  if (baseType === 'air') return 'impact';
  return 'void';
}

export function evolveElement(element: CustomElement): CustomElement {
  if (element.tier >= 20) return element;
  
  return {
    ...element,
    id: `evolved_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    tier: element.tier + 1,
    name: element.tier >= 5 ? `Greater ${element.name}` : `${element.name} +`,
  };
}

export function getDamageMultiplier(state: GameState, attackerStr: ElementType | 'void', defenderStr: ElementType | 'void'): number {
  const attacker = getBaseType(state, attackerStr);
  const defender = getBaseType(state, defenderStr);
  
  if (attacker === 'void' || defender === 'void') return 1;
  if (attacker === defender) return 1;
  
  const counters: Record<ElementType, ElementType> = {
    water: 'fire',
    fire: 'earth',
    earth: 'air',
    air: 'water'
  };

  if (counters[attacker] === defender) return 2.0;
  if (counters[defender] === attacker) return 0.5;
  return 1.0;
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function addFloatingText(state: GameState, x: number, y: number, text: string, color: string) {
  const id = generateId();
  state.floatingTexts[id] = { id, x, y, text, color, life: 30, maxLife: 30 };
}

export function addImpactDecal(state: GameState, x: number, y: number, color: string, type: 'scorch' | 'ice' | 'impact' | 'poison' | 'void') {
  const id = generateId();
  state.impactDecals[id] = { id, x, y, color, size: 20 + Math.random() * 20, life: 300, maxLife: 300, type };
}

export function spawnHazardCluster(state: GameState) {
  const playerIds = Object.keys(state.players);
  if (playerIds.length === 0) return;
  const target = state.players[playerIds[Math.floor(Math.random() * playerIds.length)]];
  
  const types: HazardType[] = ['lava', 'blizzard', 'vines', 'spikes'];
  const type = types[Math.floor(Math.random() * types.length)];
  
  const clusterSize = 3 + Math.floor(Math.random() * 5);
  const centerX = target.x + (Math.random() - 0.5) * 2000;
  const centerY = target.y + (Math.random() - 0.5) * 2000;

  for (let i = 0; i < clusterSize; i++) {
    const id = generateId();
    state.hazards[id] = {
      id,
      x: centerX + (Math.random() - 0.5) * 400,
      y: centerY + (Math.random() - 0.5) * 400,
      type,
      radius: 80 + Math.random() * 100,
      life: 3600 + Math.random() * 3600, // 1 to 2 minutes
      maxLife: 7200
    };
  }
}

export function spawnBoss(state: GameState) {
  const id = generateId();
  const angle = Math.random() * Math.PI * 2;
  const dist = 600 + Math.random() * 200;
  
  const playerIds = Object.keys(state.players);
  if (playerIds.length === 0) return;
  const target = state.players[playerIds[Math.floor(Math.random() * playerIds.length)]];
  
  const x = target.x + Math.cos(angle) * dist;
  const y = target.y + Math.sin(angle) * dist;

  const elements: ElementType[] = ['fire', 'water', 'earth', 'air'];
  const shieldElement = elements[Math.floor(Math.random() * elements.length)];

  state.bosses[id] = {
    id, x, y, type: 'void_creature', hp: 2000, maxHp: 2000, speed: 1.5,
    coinsToDrop: 1000, vx: 0, vy: 0, isBoss: true, name: 'Elemental Titan',
    phase: 1, shieldElement, shieldHp: 500, maxShieldHp: 500,
    abilityCooldown: 180, // 3 seconds
    attackPattern: 0,
    statusEffects: []
  };

  addFloatingText(state, target.x, target.y - 100, "BOSS INCOMING!", "#facc15");
}

export function dropLoot(state: GameState, x: number, y: number, coins: number) {
  if (coins <= 0) return;
  const id = generateId();
  state.lootOrbs[id] = { id, x, y, coins, life: 600 }; // 10 seconds
}

export function spawnEnemy(state: GameState, isMultiplayer: boolean) {
  const id = generateId();
  const isBot = !isMultiplayer && Math.random() < 0.2; // 20% chance for bot in SP
  
  const angle = Math.random() * Math.PI * 2;
  const dist = 800 + Math.random() * 400;
  
  // Pick a random player to spawn near
  const playerIds = Object.keys(state.players);
  if (playerIds.length === 0) return;
  const targetPlayer = state.players[playerIds[Math.floor(Math.random() * playerIds.length)]];
  
  const x = targetPlayer.x + Math.cos(angle) * dist;
  const y = targetPlayer.y + Math.sin(angle) * dist;

  if (isBot) {
    const elements: ElementType[] = ['fire', 'water', 'earth', 'air'];
    state.enemies[id] = {
      id, x, y, type: 'alchemist_bot', hp: 200, maxHp: 200, speed: 3,
      element: elements[Math.floor(Math.random() * elements.length)],
      coinsToDrop: 150, vx: 0, vy: 0, lastShot: 0, statusEffects: []
    };
  } else {
    state.enemies[id] = {
      id, x, y, type: 'void_creature', hp: 50, maxHp: 50, speed: 2,
      coinsToDrop: 20, vx: 0, vy: 0, statusEffects: []
    };
  }
}

export function getTileAt(state: GameState, tx: number, ty: number): string {
  const noise = (x: number, y: number, s: number) => {
    const v = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
    return v - Math.floor(v);
  };

  // Layer logic (Terraria style)
  // Surface: ty < 10
  // Underground: 10 <= ty < 50
  // Cavern: 50 <= ty < 150
  // Underworld: ty >= 150

  const caveNoise = noise(tx, ty, 1337);
  const biomeX = Math.floor(tx / 30);
  const biomeNoise = noise(biomeX, 0, 0);

  if (ty < 10) {
    // Surface
    if (caveNoise < 0.05) return 'wall_dirt';
    if (biomeNoise < 0.1) return 'volcanic_ash'; // New biome
    if (biomeNoise < 0.2) return 'jungle_grass';
    if (biomeNoise < 0.3) return 'corruption_grass';
    if (biomeNoise < 0.4) return 'crimson_grass';
    if (biomeNoise < 0.5) return 'snow';
    if (biomeNoise < 0.6) return 'desert_sand';
    if (biomeNoise < 0.7) return 'hallow_grass';
    if (biomeNoise < 0.8) return 'crystal_fields'; // New biome
    return 'grass';
  } else if (ty < 50) {
    // Underground
    if (caveNoise < 0.25) return 'wall_dirt';
    if (caveNoise < 0.35) return 'wall_stone';
    return 'dirt';
  } else if (ty < 150) {
    // Cavern
    if (caveNoise < 0.4) return 'wall_stone';
    if (caveNoise < 0.45) return 'wall_dirt';
    return 'stone';
  } else {
    // Underworld
    if (caveNoise < 0.3) return 'wall_stone'; // Should be obsidian/ash wall
    return 'underworld_ash';
  }
}

export function isWall(tileType: string): boolean {
  return tileType.startsWith('wall_');
}

export function movePlayer(state: GameState, player: Player, input: InputState, dt: number) {
  const loadout = player.loadout;

  // Mobility
  const mobilityBase = getBaseType(state, loadout.mobility);
  const mobilityTier = getElementTier(state, loadout.mobility);
  let baseSpeed = 210; // 3.5 * 60
  if (mobilityBase === 'air') baseSpeed = 360 + (mobilityTier * 9);
  else if (mobilityBase === 'fire') baseSpeed = 270 + (mobilityTier * 6);
  else if (mobilityBase === 'water') baseSpeed = 240 + (mobilityTier * 5);
  else if (mobilityBase === 'earth') baseSpeed = 180 + (mobilityTier * 3);
  
  player.speed = baseSpeed;
  player.vx = input.dx * player.speed * dt;
  player.vy = input.dy * player.speed * dt;

  const nextX = player.x + player.vx;
  const nextY = player.y + player.vy;

  // Collision with walls
  const TILE_SIZE = 64;
  const checkCollision = (nx: number, ny: number) => {
    const radius = 15;
    const points = [
      {x: nx - radius, y: ny - radius},
      {x: nx + radius, y: ny - radius},
      {x: nx - radius, y: ny + radius},
      {x: nx + radius, y: ny + radius}
    ];
    for (const p of points) {
      const tx = Math.floor(p.x / TILE_SIZE);
      const ty = Math.floor(p.y / TILE_SIZE);
      const tk = `${tx},${ty}`;
      const tt = state.tiles?.[tk] || getTileAt(state, tx, ty);
      if (isWall(tt)) return true;
    }
    return false;
  };
  
  if (!checkCollision(nextX, nextY)) {
    player.x = nextX;
    player.y = nextY;
  } else {
    // Sliding collision
    if (!checkCollision(nextX, player.y)) player.x = nextX;
    else if (!checkCollision(player.x, nextY)) player.y = nextY;
  }
}

export function updateGameState(
  state: GameState, 
  inputs: Map<string, InputState>, 
  lastShots: Map<string, number>, 
  lastUltimates: Map<string, number>,
  now: number,
  dt: number,
  isMultiplayer: boolean
) {
  // 1. Process Players
  for (const [id, input] of inputs.entries()) {
    const player = state.players[id];
    if (!player || player.isDead) continue;

    processStatusEffects(player, dt, state, player.x, player.y);

    if (player.stunned && player.stunned > 0) {
      player.stunned -= dt * 60;
      continue;
    }

    const loadout = player.loadout;

    // Mobility/Movement
    movePlayer(state, player, input, dt);

    // Healing

    // Bailout system (only if completely broke and no items)
    if (player.coins <= 0 && player.inventory.length === 0) {
      player.coins = 400;
    }

    // Ultimate
    if (input.isUltimate && loadout.ultimate) {
      const lastUlt = lastUltimates.get(id) || 0;
      if (now - lastUlt > 5000) { // 5 second cooldown
        lastUltimates.set(id, now);
        player.lastUltimate = now;
        
        const ultBase = getBaseType(state, loadout.ultimate);
        const ultTier = getElementTier(state, loadout.ultimate);
        const baseDmg = 30 + (ultTier * 5);

        if (ultBase === 'fire') {
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const pId = generateId();
            state.projectiles[pId] = {
              id: pId, ownerId: id, x: player.x, y: player.y,
              vx: Math.cos(angle) * 10, vy: Math.sin(angle) * 10,
              element: loadout.ultimate, damage: baseDmg, life: 60
            };
          }
        } else if (ultBase === 'water') {
          for (let i = -1; i <= 1; i++) {
            const angle = Math.atan2(input.aimY, input.aimX) + (i * 0.2);
            const pId = generateId();
            state.projectiles[pId] = {
              id: pId, ownerId: id, x: player.x, y: player.y,
              vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8,
              element: loadout.ultimate, damage: baseDmg + 10, life: 90
            };
          }
        } else if (ultBase === 'earth') {
          Object.values(state.enemies).forEach(enemy => {
            const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (dist < 150 + (ultTier * 10)) {
              enemy.hp -= baseDmg + 20;
              addFloatingText(state, enemy.x, enemy.y, `-${baseDmg + 20}`, getElementColor(state, loadout.ultimate));
              if (enemy.hp <= 0) {
                dropLoot(state, enemy.x, enemy.y, enemy.coinsToDrop);
                delete state.enemies[enemy.id];
              }
            }
          });
        } else if (ultBase === 'air') {
          for (let i = -2; i <= 2; i++) {
            const angle = Math.atan2(input.aimY, input.aimX) + (i * 0.1);
            const pId = generateId();
            state.projectiles[pId] = {
              id: pId, ownerId: id, x: player.x, y: player.y,
              vx: Math.cos(angle) * 15, vy: Math.sin(angle) * 15,
              element: loadout.ultimate, damage: baseDmg - 10, life: 40
            };
          }
        }
      }
    }

    if (input.isShooting) {
      const lastShot = lastShots.get(id) || 0;
      const fireRate = 200; // ms
      if (now - lastShot > fireRate) {
        const element = player.loadout.attack || 'void';
        const atkTier = getElementTier(state, element);
        const customEl = state.customElements?.[element];
        const rarity = customEl?.rarity || 'common';
        
        const spawnProjectile = (vx: number, vy: number, dmgMult = 1) => {
          const projId = generateId();
          const effectType = getCustomElementEffect(state, element);
          state.projectiles[projId] = {
            id: projId,
            x: player.x,
            y: player.y,
            vx,
            vy,
            ownerId: id,
            life: 60,
            element,
            damage: (25 + (atkTier * 5)) * dmgMult,
            effectType
          };
        };

        if (rarity === 'legendary') {
          // Triple shot for legendary
          for (let i = -1; i <= 1; i++) {
            const angle = Math.atan2(input.aimY, input.aimX) + (i * 0.15);
            spawnProjectile(Math.cos(angle) * 15, Math.sin(angle) * 15, 0.8);
          }
        } else if (rarity === 'epic') {
          // Double shot for epic
          for (let i = -1; i <= 1; i += 2) {
            const angle = Math.atan2(input.aimY, input.aimX) + (i * 0.1);
            spawnProjectile(Math.cos(angle) * 15, Math.sin(angle) * 15, 0.9);
          }
        } else {
          spawnProjectile(input.aimX * 15, input.aimY * 15);
        }
        
        lastShots.set(id, now);
      }
    }
  }

    // 2. Process Enemies
    // Spawn enemies randomly
    if (Math.random() < 0.005 * dt * 60) { // roughly 1 per 3 seconds at 60fps
      const maxEnemies = Math.min(isMultiplayer ? Object.keys(state.players).length * 5 : 10, 30);
      if (Object.keys(state.enemies).length < maxEnemies) {
        spawnEnemy(state, isMultiplayer);
      }
    }

    for (const enemyId in state.enemies) {
      const enemy = state.enemies[enemyId];
      
      processStatusEffects(enemy, dt, state, enemy.x, enemy.y);
      
      // Find closest player
      let closestPlayer: Player | null = null;
      let minDist = Infinity;
      for (const pid in state.players) {
        const p = state.players[pid];
        const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
        if (dist < minDist) {
          minDist = dist;
          closestPlayer = p;
        }
      }

      if (closestPlayer) {
        const dx = closestPlayer.x - enemy.x;
        const dy = closestPlayer.y - enemy.y;
        const dist = Math.hypot(dx, dy);
        
        // Basic Pathfinder: Avoid walls and hazards
        let targetVx = 0;
        let targetVy = 0;

        if (dist > 0) {
          targetVx = (dx / dist) * enemy.speed * dt * 60;
          targetVy = (dy / dist) * enemy.speed * dt * 60;
        }

        // Avoidance logic
        const checkPoints = [
          { x: enemy.x + targetVx * 5, y: enemy.y + targetVy * 5 }, // Forward
          { x: enemy.x + targetVx * 5 - targetVy * 5, y: enemy.y + targetVy * 5 + targetVx * 5 }, // Left
          { x: enemy.x + targetVx * 5 + targetVy * 5, y: enemy.y + targetVy * 5 - targetVx * 5 }, // Right
        ];

        let blocked = false;
        for (const pt of checkPoints) {
          const tx = Math.floor(pt.x / 64);
          const ty = Math.floor(pt.y / 64);
          if (isWall(getTileAt(state, tx, ty))) {
            blocked = true;
            break;
          }
          // Also avoid hazards
          for (const hid in state.hazards) {
            const h = state.hazards[hid];
            if (Math.hypot(pt.x - h.x, pt.y - h.y) < h.radius) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
        }

        if (blocked) {
          // Try to steer away
          const temp = targetVx;
          targetVx = -targetVy;
          targetVy = temp;
        }

        enemy.vx = targetVx;
        enemy.vy = targetVy;

        // Wall collision check for actual movement
        const nextX = enemy.x + enemy.vx;
        const nextY = enemy.y + enemy.vy;
        
        const tx = Math.floor(nextX / 64);
        const ty = Math.floor(nextY / 64);
        
        if (!isWall(getTileAt(state, tx, ty))) {
          enemy.x = nextX;
          enemy.y = nextY;
        } else {
          // Slide along walls
          const txX = Math.floor(nextX / 64);
          const tyX = Math.floor(enemy.y / 64);
          if (!isWall(getTileAt(state, txX, tyX))) {
            enemy.x = nextX;
          } else {
            const txY = Math.floor(enemy.x / 64);
            const tyY = Math.floor(nextY / 64);
            if (!isWall(getTileAt(state, txY, tyY))) {
              enemy.y = nextY;
            }
          }
        }

      // Bot shooting
      if (enemy.type === 'alchemist_bot' && dist < 400) {
        const lastShot = enemy.lastShot || 0;
        if (now - lastShot > 1000) {
          // Ability: Deploy buffing drone
          if (Math.random() < 0.2) {
            addFloatingText(state, enemy.x, enemy.y, 'DRONE!', '#facc15');
            // Logic to buff nearby enemies
            Object.values(state.enemies).forEach(otherEnemy => {
              if (Math.hypot(otherEnemy.x - enemy.x, otherEnemy.y - enemy.y) < 200) {
                otherEnemy.hp = Math.min(otherEnemy.maxHp, otherEnemy.hp + 20);
              }
            });
          } else {
            const projId = generateId();
            state.projectiles[projId] = {
              id: projId,
              x: enemy.x,
              y: enemy.y,
              vx: (dx / dist) * 10,
              vy: (dy / dist) * 10,
              ownerId: enemy.id,
              life: 80,
              element: enemy.element || 'void',
              damage: 15
            };
          }
          enemy.lastShot = now;
        }
      }

      // Void creature ability: Black hole
      if (enemy.type === 'void_creature' && dist < 300) {
        const lastAbility = enemy.lastAbility || 0;
        if (now - lastAbility > 3000) {
          const id = generateId();
          state.hazards[id] = {
            id, x: enemy.x, y: enemy.y, type: 'black_hole', radius: 100, life: 300, maxLife: 300
          };
          enemy.lastAbility = now;
        }
      }

      // Melee damage to player
      if (dist < 30) {
        let damage = enemy.type === 'void_creature' ? 10 : 20;
        
        // Defense logic
        const defBase = getBaseType(state, closestPlayer.loadout.defense);
        const defTier = getElementTier(state, closestPlayer.loadout.defense);
        
        if (defBase === 'earth') damage = Math.floor(damage * Math.max(0.1, 0.5 - (defTier * 0.02)));
        else if (defBase === 'water') damage = Math.floor(damage * Math.max(0.2, 0.8 - (defTier * 0.03)));
        else if (defBase === 'air' && Math.random() < Math.min(0.75, 0.25 + (defTier * 0.02))) damage = 0;
        
        if (defBase === 'fire') {
          const thornsDmg = 5 + (defTier * 2);
          enemy.hp -= thornsDmg;
          addFloatingText(state, enemy.x, enemy.y, `-${thornsDmg}`, getElementColor(state, closestPlayer.loadout.defense));
          if (enemy.hp <= 0) {
            dropLoot(state, enemy.x, enemy.y, enemy.coinsToDrop);
            delete state.enemies[enemy.id];
            continue;
          }
        }

        if (damage > 0) {
          closestPlayer.hp -= damage;
          addFloatingText(state, closestPlayer.x, closestPlayer.y - 30, `-${damage}`, '#ef4444');
        }
        
        // Knockback
        closestPlayer.x += (dx / dist) * 20;
        closestPlayer.y += (dy / dist) * 20;
        enemy.x -= (dx / dist) * 20;
        enemy.y -= (dy / dist) * 20;

        if (closestPlayer.hp <= 0) {
          // Player death
          closestPlayer.isDead = true;
          closestPlayer.hp = 0;
          addFloatingText(state, closestPlayer.x, closestPlayer.y - 30, 'DEFEATED', '#ef4444');
        }
      }
    }
  }

  // 3. Process Projectiles
  const projIds = Object.keys(state.projectiles);
  for (let i = 0; i < projIds.length; i++) {
    const p1Id = projIds[i];
    const p1 = state.projectiles[p1Id];
    if (!p1) continue;

    p1.x += p1.vx * dt * 60;
    p1.y += p1.vy * dt * 60;
    p1.life -= dt * 60;

    if (p1.life <= 0) {
      delete state.projectiles[p1Id];
      continue;
    }

    // Projectile vs Projectile clashing
    let clashed = false;
    for (let j = i + 1; j < projIds.length; j++) {
      const p2Id = projIds[j];
      const p2 = state.projectiles[p2Id];
      if (!p2 || p1.ownerId === p2.ownerId) continue;

      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (dist < 15) { // Collision radius
        const mult1 = getDamageMultiplier(state, p1.element, p2.element);
        const mult2 = getDamageMultiplier(state, p2.element, p1.element);
        
        const effDmg1 = p1.damage * mult1;
        const effDmg2 = p2.damage * mult2;

        if (effDmg1 > effDmg2) {
          p1.damage -= p2.damage;
          delete state.projectiles[p2Id];
          addFloatingText(state, p1.x, p1.y, 'Destroyed!', getElementColor(state, p1.element));
        } else if (effDmg2 > effDmg1) {
          p2.damage -= p1.damage;
          delete state.projectiles[p1Id];
          addFloatingText(state, p2.x, p2.y, 'Destroyed!', getElementColor(state, p2.element));
          clashed = true;
          break;
        } else {
          delete state.projectiles[p1Id];
          delete state.projectiles[p2Id];
          addFloatingText(state, p1.x, p1.y, 'Clash!', '#fff');
          clashed = true;
          break;
        }
      }
    }
    if (clashed) continue;

    // Projectile vs Enemies
    if (state.players[p1.ownerId]) { // Player projectile
      // Projectile vs Bosses
      for (const bossId in state.bosses) {
        const boss = state.bosses[bossId];
        const dist = Math.hypot(p1.x - boss.x, p1.y - boss.y);
        if (dist < 80) {
          let dmg = p1.damage;
          if (boss.shieldHp > 0) {
            const mult = getDamageMultiplier(state, p1.element, boss.shieldElement || 'void');
            const shieldDmg = Math.floor(dmg * mult);
            boss.shieldHp -= shieldDmg;
            addFloatingText(state, boss.x, boss.y - 40, `SHIELD: ${shieldDmg}`, '#60a5fa');
            if (boss.shieldHp <= 0) {
              boss.shieldHp = 0;
              addFloatingText(state, boss.x, boss.y, 'SHIELD BROKEN!', '#facc15');
            }
          } else {
            boss.hp -= dmg;
            addFloatingText(state, boss.x, boss.y - 40, `${dmg}`, getElementColor(state, p1.element));
          }
          addImpactDecal(state, p1.x, p1.y, getElementColor(state, p1.element), getDecalType(state, p1.element));
          delete state.projectiles[p1Id];
          clashed = true;
          break;
        }
      }
      if (clashed) continue;

      for (const enemyId in state.enemies) {
        const enemy = state.enemies[enemyId];
        const dist = Math.hypot(p1.x - enemy.x, p1.y - enemy.y);
        if (dist < 25) {
          const mult = getDamageMultiplier(state, p1.element, enemy.element || 'void');
          const dmg = Math.floor(p1.damage * mult);
          enemy.hp -= dmg;
          
          addFloatingText(state, enemy.x, enemy.y - 20, `${dmg}`, getElementColor(state, p1.element));
          addImpactDecal(state, p1.x, p1.y, getElementColor(state, p1.element), getDecalType(state, p1.element));
          
          if (enemy.hp <= 0) {
            dropLoot(state, enemy.x, enemy.y, enemy.coinsToDrop);
            delete state.enemies[enemyId];
            
            // Healing on kill
            const killer = state.players[p1.ownerId];
            if (killer && getBaseType(state, killer.loadout.healing) === 'fire') {
              const healAmount = 10 + (getElementTier(state, killer.loadout.healing) * 2);
              killer.hp = Math.min(killer.maxHp, killer.hp + healAmount);
              addFloatingText(state, killer.x, killer.y, `+${healAmount}`, '#22c55e');
            }
          }
          
          delete state.projectiles[p1Id];
          clashed = true;
          break;
        }
      }
    } else { // Enemy projectile
      for (const pid in state.players) {
        if (pid === p1.ownerId) continue;
        const player = state.players[pid];
        const dist = Math.hypot(p1.x - player.x, p1.y - player.y);
        if (dist < 25) {
          const mult = getDamageMultiplier(state, p1.element, player.loadout.defense || 'void');
          let dmg = Math.floor(p1.damage * mult);
          
          // Defense logic
          const defBase = getBaseType(state, player.loadout.defense);
          const defTier = getElementTier(state, player.loadout.defense);
          if (defBase === 'earth') dmg = Math.floor(dmg * Math.max(0.1, 0.5 - (defTier * 0.02)));
          else if (defBase === 'water') dmg = Math.floor(dmg * Math.max(0.2, 0.8 - (defTier * 0.03)));
          else if (defBase === 'air' && Math.random() < Math.min(0.75, 0.25 + (defTier * 0.02))) dmg = 0;

          if (dmg > 0) {
            player.hp -= dmg;
            addFloatingText(state, player.x, player.y - 20, `-${dmg}`, '#ef4444');
          }
          
          if (player.hp <= 0) {
            player.isDead = true;
            player.hp = 0;
            addFloatingText(state, player.x, player.y - 30, 'DEFEATED', '#ef4444');
          }
          
          delete state.projectiles[p1Id];
          clashed = true;
          break;
        }
      }
    }
    if (clashed) continue;

    // Projectile vs Players (PvP)
    if (isMultiplayer && state.players[p1.ownerId]) {
      for (const pid in state.players) {
        if (pid === p1.ownerId) continue;
        const player = state.players[pid];
        const dist = Math.hypot(p1.x - player.x, p1.y - player.y);
        if (dist < 25) {
          const mult = getDamageMultiplier(state, p1.element, player.loadout.defense || 'void');
          let dmg = Math.floor(p1.damage * mult);
          
          // Defense logic
          const defBase = getBaseType(state, player.loadout.defense);
          const defTier = getElementTier(state, player.loadout.defense);
          if (defBase === 'earth') dmg = Math.floor(dmg * Math.max(0.1, 0.5 - (defTier * 0.02)));
          else if (defBase === 'water') dmg = Math.floor(dmg * Math.max(0.2, 0.8 - (defTier * 0.03)));
          else if (defBase === 'air' && Math.random() < Math.min(0.75, 0.25 + (defTier * 0.02))) dmg = 0;

          if (dmg > 0) {
            player.hp -= dmg;
            addFloatingText(state, player.x, player.y - 20, `-${dmg}`, '#ef4444');
          }
          
          if (player.hp <= 0) {
            const coinsLost = Math.floor(player.coins * (player.pvpPenalty / 100));
            player.coins -= coinsLost;
            
            if (coinsLost > 0) {
              dropLoot(state, player.x, player.y, coinsLost);
            }

            player.hp = player.maxHp;
            player.x = Math.random() * 500 - 250;
            player.y = Math.random() * 500 - 250;
            addFloatingText(state, player.x, player.y - 30, 'Respawned', '#ffffff');
          }
          
          delete state.projectiles[p1Id];
          break;
        }
      }
    }
  }

  // 4. Process Loot Orbs
  for (const orbId in state.lootOrbs) {
    const orb = state.lootOrbs[orbId];
    orb.life -= dt * 60;
    if (orb.life <= 0) {
      delete state.lootOrbs[orbId];
      continue;
    }

    for (const pid in state.players) {
      const player = state.players[pid];
      const dist = Math.hypot(orb.x - player.x, orb.y - player.y);
      if (dist < 30) {
        player.coins += orb.coins;
        addFloatingText(state, player.x, player.y - 30, `+${orb.coins} Coins`, '#eab308');
        delete state.lootOrbs[orbId];
        break;
      }
    }
  }

  // 5. Process Floating Texts
  for (const textId in state.floatingTexts) {
    const text = state.floatingTexts[textId];
    text.life -= dt * 60;
    text.y -= 0.5 * dt * 60; // float up
    if (text.life <= 0) {
      delete state.floatingTexts[textId];
    }
  }

    // 6. Process Hazards
    const hazardCount = Object.keys(state.hazards).length;
    if (hazardCount < 40 && Math.random() < 0.05 * dt * 60) {
      spawnHazardCluster(state);
    }
    
    for (const id in state.hazards) {
      const h = state.hazards[id];
      h.life -= dt * 60;
      if (h.life <= 0) {
        delete state.hazards[id];
        continue;
      }

      // Effect on players
      for (const pid in state.players) {
        const p = state.players[pid];
        const dist = Math.hypot(p.x - h.x, p.y - h.y);
        if (dist < h.radius) {
          if (h.type === 'lava') {
            p.hp -= 0.2 * dt * 60;
            if (Math.random() < 0.05 * dt * 60) addFloatingText(state, p.x, p.y, 'BURN', '#ef4444');
          } else if (h.type === 'blizzard') {
            p.speed *= 0.5;
          } else if (h.type === 'vines') {
            p.speed *= 0.2;
          } else if (h.type === 'spikes') {
            p.hp -= 1 * dt * 60;
            if (Math.random() < 0.1 * dt * 60) addFloatingText(state, p.x, p.y, 'SPIKED', '#94a3b8');
            
            if (p.hp <= 0) {
              // Player death
              const penalty = p.pvePenalty;
              const coinsLost = Math.floor(p.coins * (penalty / 100));
              p.coins -= coinsLost;
              
              if (coinsLost > 0) {
                dropLoot(state, p.x, p.y, coinsLost);
              }

              p.hp = p.maxHp;
              p.x = Math.random() * 500 - 250;
              p.y = Math.random() * 500 - 250;
              addFloatingText(state, p.x, p.y - 30, 'Respawned', '#ffffff');
            }
          }
        }
      }

      // Effect on enemies (Bosses immune)
      for (const eid in state.enemies) {
        const e = state.enemies[eid];
        const dist = Math.hypot(e.x - h.x, e.y - h.y);
        if (dist < h.radius) {
          if (h.type === 'lava') {
            e.hp -= 0.5 * dt * 60;
            if (Math.random() < 0.05 * dt * 60) addFloatingText(state, e.x, e.y, 'BURN', '#ef4444');
          } else if (h.type === 'blizzard') {
            e.speed *= 0.5;
          } else if (h.type === 'vines') {
            e.speed *= 0.2;
          } else if (h.type === 'spikes') {
            e.hp -= 2 * dt * 60;
            if (Math.random() < 0.1 * dt * 60) addFloatingText(state, e.x, e.y, 'SPIKED', '#94a3b8');
          }

          if (e.hp <= 0) {
            dropLoot(state, e.x, e.y, e.coinsToDrop);
            delete state.enemies[eid];
          }
        }
      }
    }

  // 7. Process Bosses
  if (Math.random() < 0.0005 * dt * 60 && Object.keys(state.bosses).length === 0) spawnBoss(state);
  for (const id in state.bosses) {
    const b = state.bosses[id];
    
    // Boss phases
    const hpPercent = b.hp / b.maxHp;
    if (hpPercent < 0.3) {
      b.phase = 3;
      b.speed = 2.5; // Faster
    } else if (hpPercent < 0.6) {
      b.phase = 2;
      b.speed = 2.0;
    } else {
      b.phase = 1;
      b.speed = 1.5;
    }
    
    // Simple AI: Move towards closest player
    let closestP: Player | null = null;
    let minDist = Infinity;
    for (const pid in state.players) {
      const p = state.players[pid];
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      if (dist < minDist) {
        minDist = dist;
        closestP = p;
      }
    }

    if (closestP) {
      const dx = closestP.x - b.x;
      const dy = closestP.y - b.y;
      const dist = Math.hypot(dx, dy);
      
      if (b.abilityCooldown > 0) b.abilityCooldown -= dt * 60;

      if (dist > 0) {
        b.x += (dx / dist) * b.speed * dt * 60;
        b.y += (dy / dist) * b.speed * dt * 60;
      }

      // Boss abilities
      if (b.abilityCooldown <= 0) {
        const rand = Math.random();
        
        // Phase 1: Shield Bash, Ground Pound
        // Phase 2: Adds Projectile Storm
        // Phase 3: Adds Teleport
        
        if (b.phase >= 2 && rand < 0.3) {
          // Projectile Storm
          b.abilityCooldown = 180;
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const pId = generateId();
            state.projectiles[pId] = {
              id: pId, ownerId: b.id, x: b.x, y: b.y,
              vx: Math.cos(angle) * 8, vy: Math.sin(angle) * 8,
              element: 'void', damage: 15, life: 120
            };
          }
        } else if (b.phase >= 3 && rand < 0.5) {
          // Teleport
          b.x = closestP.x + (Math.random() - 0.5) * 400;
          b.y = closestP.y + (Math.random() - 0.5) * 400;
          b.abilityCooldown = 120;
        } else if (rand < 0.5 && dist < 200) {
          // Shield Bash
          b.abilityCooldown = 240; // 4 seconds
          closestP.stunned = 60; // 1 second
          closestP.hp -= 10;
          addFloatingText(state, closestP.x, closestP.y, "STUNNED!", "#ef4444");
          // Visual effect
          for (let i = 0; i < 10; i++) {
            addImpactDecal(state, b.x + (dx/dist)*50, b.y + (dy/dist)*50, '#94a3b8', 'impact');
          }
        } else {
          // Ground Pound
          b.abilityCooldown = 300; // 5 seconds
          addFloatingText(state, b.x, b.y - 100, "GROUND POUND!", "#facc15");
          // Create shockwave hazards
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const hId = generateId();
            state.hazards[hId] = {
              id: hId,
              x: b.x + Math.cos(angle) * 100,
              y: b.y + Math.sin(angle) * 100,
              type: 'lava', // Using lava as a base for damage
              radius: 80,
              life: 120,
              maxLife: 120
            };
          }
        }
      }

      // Boss attacks (regular)
      if (Math.random() < 0.02 * dt * 60) {
        const pId = generateId();
        state.projectiles[pId] = {
          id: pId, ownerId: b.id, x: b.x, y: b.y,
          vx: (dx / dist) * 8, vy: (dy / dist) * 8,
          element: 'void', damage: 25, life: 100
        };
      }

      // Melee
      if (dist < 100) {
        closestP.hp -= 0.5;
      }
    }

    if (b.hp <= 0) {
      dropLoot(state, b.x, b.y, b.coinsToDrop);
      delete state.bosses[id];
    }
  }

  // 8. Process Impact Decals
  for (const id in state.impactDecals) {
    const d = state.impactDecals[id];
    d.life--;
    if (d.life <= 0) delete state.impactDecals[id];
  }

  // 9. Update Player Auras/Trails
  for (const pid in state.players) {
    const p = state.players[pid];
    if (p.coins > 5000) p.aura = '#facc15'; // Gold aura for rich players
    else if (p.coins > 2000) p.aura = '#60a5fa'; // Blue aura
    
    if (p.hp < p.maxHp * 0.3) p.aura = '#ef4444'; // Red aura when low health
  }
}
