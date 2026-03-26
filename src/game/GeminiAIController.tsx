import { useEffect, useRef } from 'react';
import { GameState } from '../shared';
import { GoogleGenAI, Type } from '@google/genai';

interface GeminiAIControllerProps {
  gameState: GameState;
  onIntent: (enemyId: string, intent: any) => void;
  isActive: boolean;
}

export default function GeminiAIController({ gameState, onIntent, isActive }: GeminiAIControllerProps) {
  const lastRun = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isActive) return;

    // Use the API key from environment variables
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("Gemini API Key missing. Enemy AI will use default behavior.");
      return;
    }

    const ai = new GoogleGenAI({ apiKey });

    const runAI = async () => {
      const now = Date.now();
      const enemiesToProcess = [
        ...Object.values(gameState.enemies),
        ...Object.values(gameState.bosses)
      ];

      for (const enemy of enemiesToProcess) {
        // Only run Gemini AI for bosses or specific smart enemies
        if (enemy.type === 'alchemist_bot' || (enemy as any).isBoss) {
          // Rate limit: update intent every 4 seconds per enemy
          if (!lastRun.current[enemy.id] || now - lastRun.current[enemy.id] > 4000) {
            lastRun.current[enemy.id] = now;

            const nearbyProjectiles = Object.values(gameState.projectiles)
              .filter(p => Math.hypot(p.x - enemy.x, p.y - enemy.y) < 400)
              .map(p => ({ dx: Math.round(p.x - enemy.x), dy: Math.round(p.y - enemy.y) }));

            const nearbyHazards = Object.values(gameState.hazards)
              .filter(h => Math.hypot(h.x - enemy.x, h.y - enemy.y) < 300)
              .map(h => ({ dx: Math.round(h.x - enemy.x), dy: Math.round(h.y - enemy.y) }));

            const players = Object.values(gameState.players)
              .map(p => ({ dx: Math.round(p.x - enemy.x), dy: Math.round(p.y - enemy.y), hp: Math.round(p.hp) }));

            const prompt = `You are a highly strategic AI for a boss/enemy in a 2D action game.
Players relative to you (dx, dy, hp): ${JSON.stringify(players)}
Incoming projectiles relative to you (dx, dy): ${JSON.stringify(nearbyProjectiles)}
Hazards relative to you (dx, dy): ${JSON.stringify(nearbyHazards)}

Your goal is to defeat players while minimizing damage to yourself.
Strategies:
- If a projectile is very close, prioritize "dodge" by moving perpendicular to it.
- If your HP is low, "flee" from players.
- If a player is close and you have an opening, "shoot" or "chase".
- Stay away from hazards.

Respond in JSON format with:
- dx: direction x to move (-1 to 1, use decimals for precision)
- dy: direction y to move (-1 to 1, use decimals for precision)
- action: "chase", "flee", "dodge", or "shoot"
- reasoning: a short string explaining your choice (for internal logic)`;

            try {
              const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      dx: { type: Type.NUMBER },
                      dy: { type: Type.NUMBER },
                      action: { type: Type.STRING },
                      reasoning: { type: Type.STRING }
                    },
                    required: ["dx", "dy", "action", "reasoning"]
                  }
                }
              });

              if (response.text) {
                const intent = JSON.parse(response.text);
                onIntent(enemy.id, { ...intent, timestamp: Date.now() });
              }
            } catch (e) {
              console.error("Gemini AI error", e);
            }
          }
        }
      }
    };

    const interval = setInterval(runAI, 2000);
    return () => clearInterval(interval);
  }, [gameState, onIntent, isActive]);

  return null;
}
