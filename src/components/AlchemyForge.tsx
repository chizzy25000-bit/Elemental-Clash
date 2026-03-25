import React, { useState } from 'react';
import { ElementType, CustomElement } from '../shared';
import { GoogleGenAI, Type } from '@google/genai';

interface Props {
  coins: number;
  inventory: ElementType[];
  customElements: Record<string, CustomElement>;
  onForge: (newElement: CustomElement, cost: number) => void;
  onClose: () => void;
}

const BASE_ELEMENTS: { id: ElementType; name: string; color: string; tier: number }[] = [
  { id: 'fire', name: 'Fire', color: 'bg-red-500', tier: 1 },
  { id: 'water', name: 'Water', color: 'bg-blue-500', tier: 1 },
  { id: 'earth', name: 'Earth', color: 'bg-emerald-600', tier: 1 },
  { id: 'air', name: 'Air', color: 'bg-slate-300', tier: 1 },
];

export default function AlchemyForge({ coins, inventory, customElements, onForge, onClose }: Props) {
  const [el1, setEl1] = useState<ElementType | null>(null);
  const [el2, setEl2] = useState<ElementType | null>(null);
  const [isForging, setIsForging] = useState(false);
  const [result, setResult] = useState<CustomElement | null>(null);
  const [cost, setCost] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const getElementDetails = (id: ElementType) => {
    if (BASE_ELEMENTS.find(e => e.id === id)) return BASE_ELEMENTS.find(e => e.id === id)!;
    return customElements[id];
  };

  const handleForge = async () => {
    if (!el1 || !el2) return;
    setIsForging(true);
    setError(null);
    setResult(null);

    const e1Details = getElementDetails(el1);
    const e2Details = getElementDetails(el2);

    if (!e1Details || !e2Details) {
      setError("Invalid elements selected.");
      setIsForging(false);
      return;
    }

    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not defined");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        I am combining two magical elements in a game:
        Element 1: ${e1Details.name} (Tier ${e1Details.tier})
        Element 2: ${e2Details.name} (Tier ${e2Details.tier})
        
        Generate a new, unique element that is a combination of these two.
        The new tier should be calculated as follows: max(Tier 1, Tier 2) + 1. 
        The maximum tier is 20.
        The baseType MUST be one of: 'fire', 'water', 'earth', 'air'. Choose the one that fits best.
        The color must be a valid Tailwind CSS background color class (e.g., 'bg-purple-500', 'bg-yellow-400').
        Generate a short themeDescription and a rarity (common, rare, epic, legendary).
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "The name of the new element" },
              color: { type: Type.STRING, description: "A Tailwind CSS background color class" },
              tier: { type: Type.INTEGER, description: "The calculated tier (max 20)" },
              baseType: { type: Type.STRING, description: "One of: 'fire', 'water', 'earth', 'air'" },
              themeDescription: { type: Type.STRING, description: "A short description of the element's visual theme and power" },
              rarity: { type: Type.STRING, description: "One of: 'common', 'rare', 'epic', 'legendary'" }
            },
            required: ["name", "color", "tier", "baseType", "themeDescription", "rarity"]
          }
        }
      });

      const data = JSON.parse(response.text || '{}');
      
      // Enforce constraints
      const finalTier = Math.min(20, Math.max(1, data.tier));
      const finalBaseType = ['fire', 'water', 'earth', 'air'].includes(data.baseType) ? data.baseType : 'void';
      const finalRarity = ['common', 'rare', 'epic', 'legendary'].includes(data.rarity) ? data.rarity : 'common';
      
      // Calculate cost: exponential scaling, base 500, factor 1.5, cap 15000
      const calculatedCost = Math.min(15000, Math.floor(500 * Math.pow(1.5, finalTier - 1)));

      const newElement: CustomElement = {
        id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: data.name || 'Unknown Anomaly',
        color: data.color || 'bg-gray-500',
        tier: finalTier,
        baseType: finalBaseType as any,
        themeDescription: data.themeDescription || 'A mysterious combination of elements.',
        rarity: finalRarity as any
      };

      setResult(newElement);
      setCost(calculatedCost);

    } catch (err) {
      console.error("Forging error:", err);
      setError("The forge sputtered and failed. Try again.");
    } finally {
      setIsForging(false);
    }
  };

  const confirmForge = () => {
    if (result && coins >= cost) {
      onForge(result, cost);
      setEl1(null);
      setEl2(null);
      setResult(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-purple-500/50 rounded-2xl shadow-[0_0_50px_rgba(168,85,247,0.2)] w-full max-w-4xl flex flex-col overflow-hidden max-h-full">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-purple-900/50 bg-slate-900 shrink-0">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Alchemy Forge
          </h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 text-sm font-bold uppercase tracking-wider">Coins</span>
              <span className="text-2xl font-black text-yellow-400">{coins}</span>
            </div>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-white font-bold transition-colors">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-4 md:p-6 gap-6 md:gap-8 overflow-y-auto min-h-0 pb-24 touch-pan-y overscroll-contain">
          
          {/* Left: Inventory */}
          <div className="flex-1 flex flex-col gap-4 md:border-r border-slate-800 md:pr-6">
            <h3 className="text-xl font-bold text-slate-300">Your Elements</h3>
            <div className="grid grid-cols-3 gap-3">
              {inventory.map(id => {
                const el = getElementDetails(id);
                if (!el) return null;
                const isSelected = el1 === id || el2 === id;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      if (isSelected) {
                        if (el1 === id) setEl1(null);
                        if (el2 === id) setEl2(null);
                      } else {
                        if (!el1) setEl1(id);
                        else if (!el2) setEl2(id);
                      }
                    }}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${isSelected ? 'border-purple-500 bg-purple-500/20 scale-105' : 'border-slate-700 bg-slate-800 hover:border-slate-500'}`}
                  >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black text-white shadow-lg ${el.color}`}>
                      {el.name[0]}
                    </div>
                    <div className="text-xs font-bold text-slate-300 text-center truncate w-full">{el.name}</div>
                    <div className="text-[10px] text-purple-400">Tier {el.tier}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Forge Area */}
          <div className="flex-[1.5] flex flex-col items-center justify-center gap-8">
            
            <div className="flex items-center justify-center gap-8 w-full">
              {/* Slot 1 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center ${el1 ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                  {el1 ? (
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black text-white shadow-lg ${getElementDetails(el1)?.color}`}>
                      {getElementDetails(el1)?.name[0]}
                    </div>
                  ) : <span className="text-slate-600 text-sm">Select</span>}
                </div>
                {el1 && <div className="text-sm font-bold text-slate-300">{getElementDetails(el1)?.name}</div>}
              </div>

              <div className="text-4xl font-black text-slate-600">+</div>

              {/* Slot 2 */}
              <div className="flex flex-col items-center gap-2">
                <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center ${el2 ? 'border-purple-500 bg-purple-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                  {el2 ? (
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-black text-white shadow-lg ${getElementDetails(el2)?.color}`}>
                      {getElementDetails(el2)?.name[0]}
                    </div>
                  ) : <span className="text-slate-600 text-sm">Select</span>}
                </div>
                {el2 && <div className="text-sm font-bold text-slate-300">{getElementDetails(el2)?.name}</div>}
              </div>
            </div>

            {/* Action Area */}
            <div className="w-full flex flex-col items-center gap-4 min-h-[200px]">
              {!result ? (
                <button
                  onClick={handleForge}
                  disabled={!el1 || !el2 || isForging}
                  className={`px-8 py-4 rounded-xl font-black text-xl tracking-wider transition-all ${!el1 || !el2 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : isForging ? 'bg-purple-600 text-white animate-pulse' : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]'}`}
                >
                  {isForging ? 'FORGING...' : 'FUSE ELEMENTS'}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-6 w-full animate-in fade-in zoom-in duration-500">
                  <div className="text-center">
                    <h4 className="text-sm font-bold text-purple-400 uppercase tracking-widest mb-2">Discovery!</h4>
                    <div className="flex items-center justify-center gap-4">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black text-white shadow-[0_0_40px_rgba(255,255,255,0.2)] ${result.color}`}>
                        {result.name[0]}
                      </div>
                      <div className="text-left">
                        <div className="text-3xl font-black text-white">{result.name}</div>
                        <div className="text-lg text-pink-400 font-bold">
                          Tier {result.tier} • {result.baseType.toUpperCase()} Base • {result.rarity.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <p className="mt-4 text-slate-400 italic max-w-md mx-auto">"{result.themeDescription}"</p>
                  </div>

                  <div className="flex items-center gap-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700 w-full max-w-sm justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-400 uppercase font-bold">Crafting Cost</span>
                      <span className={`text-xl font-black ${coins >= cost ? 'text-yellow-400' : 'text-red-500'}`}>{cost} Coins</span>
                    </div>
                    <button
                      onClick={confirmForge}
                      disabled={coins < cost}
                      className={`px-6 py-2 rounded-lg font-bold transition-colors ${coins >= cost ? 'bg-emerald-500 hover:bg-emerald-400 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
              {error && <div className="text-red-400 font-bold text-center">{error}</div>}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
