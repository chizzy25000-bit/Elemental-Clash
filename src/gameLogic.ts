import { GameState, InputState, ElementType, Projectile, Enemy, LootOrb, FloatingText, Player, CustomElement } from './shared';

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
      coinsToDrop: 150, vx: 0, vy: 0, lastShot: 0
    };
  } else {
    state.enemies[id] = {
      id, x, y, type: 'void_creature', hp: 50, maxHp: 50, speed: 2,
      coinsToDrop: 20, vx: 0, vy: 0
    };
  }
}

export function updateGameState(
  state: GameState, 
  inputs: Map<string, InputState>, 
  lastShots: Map<string, number>, 
  lastUltimates: Map<string, number>,
  now: number,
  isMultiplayer: boolean
) {
  // 1. Process Players
  for (const [id, input] of inputs.entries()) {
    const player = state.players[id];
    if (!player) continue;

    const loadout = player.loadout;

    // Mobility
    const mobilityBase = getBaseType(state, loadout.mobility);
    const mobilityTier = getElementTier(state, loadout.mobility);
    player.speed = 5;
    if (mobilityBase === 'air') player.speed = 8 + (mobilityTier * 0.2);
    else if (mobilityBase === 'fire') player.speed = 6 + (mobilityTier * 0.15);
    else if (mobilityBase === 'water') player.speed = 5.5 + (mobilityTier * 0.1);
    else if (mobilityBase === 'earth') player.speed = 4 + (mobilityTier * 0.05);

    // Healing
    const healingBase = getBaseType(state, loadout.healing);
    const healingTier = getElementTier(state, loadout.healing);
    player.maxHp = healingBase === 'earth' ? 150 + (healingTier * 10) : 100 + (healingTier * 5);
    if (player.hp > player.maxHp) player.hp = player.maxHp;

    if (healingBase === 'water' && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 0.05 + (healingTier * 0.01));
    } else if (healingBase === 'air' && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 0.02 + (healingTier * 0.005));
    }

    player.x += input.dx * player.speed;
    player.y += input.dy * player.speed;

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
        const projId = generateId();
        const element = player.loadout.attack || 'void';
        const atkTier = getElementTier(state, element);
        state.projectiles[projId] = {
          id: projId,
          x: player.x,
          y: player.y,
          vx: input.aimX * 15,
          vy: input.aimY * 15,
          ownerId: id,
          life: 60,
          element,
          damage: 25 + (atkTier * 5)
        };
        lastShots.set(id, now);
      }
    }
  }

  // 2. Process Enemies
  // Spawn enemies randomly
  if (Math.random() < 0.005) { // roughly 1 per 3 seconds at 60fps
    const maxEnemies = Math.min(isMultiplayer ? Object.keys(state.players).length * 5 : 10, 30);
    if (Object.keys(state.enemies).length < maxEnemies) {
      spawnEnemy(state, isMultiplayer);
    }
  }

  for (const enemyId in state.enemies) {
    const enemy = state.enemies[enemyId];
    
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
      
      if (dist > 0) {
        enemy.vx = (dx / dist) * enemy.speed;
        enemy.vy = (dy / dist) * enemy.speed;
      }

      enemy.x += enemy.vx;
      enemy.y += enemy.vy;

      // Bot shooting
      if (enemy.type === 'alchemist_bot' && dist < 400) {
        const lastShot = enemy.lastShot || 0;
        if (now - lastShot > 1000) {
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
          enemy.lastShot = now;
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
          const penalty = closestPlayer.pvePenalty;
          const coinsLost = Math.floor(closestPlayer.coins * (penalty / 100));
          closestPlayer.coins -= coinsLost;
          
          if (coinsLost > 0) {
            dropLoot(state, closestPlayer.x, closestPlayer.y, coinsLost);
          }

          closestPlayer.hp = closestPlayer.maxHp;
          closestPlayer.x = Math.random() * 500 - 250;
          closestPlayer.y = Math.random() * 500 - 250;
          addFloatingText(state, closestPlayer.x, closestPlayer.y - 30, 'Respawned', '#ffffff');
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

    p1.x += p1.vx;
    p1.y += p1.vy;
    p1.life--;

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
      for (const enemyId in state.enemies) {
        const enemy = state.enemies[enemyId];
        const dist = Math.hypot(p1.x - enemy.x, p1.y - enemy.y);
        if (dist < 25) {
          const mult = getDamageMultiplier(state, p1.element, enemy.element || 'void');
          const dmg = Math.floor(p1.damage * mult);
          enemy.hp -= dmg;
          
          addFloatingText(state, enemy.x, enemy.y - 20, `${dmg}`, getElementColor(state, p1.element));
          
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
            const penalty = player.pvePenalty;
            const coinsLost = Math.floor(player.coins * (penalty / 100));
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
    orb.life--;
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
    text.life--;
    text.y -= 0.5; // float up
    if (text.life <= 0) {
      delete state.floatingTexts[textId];
    }
  }
}
