import React, { useState, useEffect } from 'react';
import { ElementType, Loadout, CustomElement } from '../shared';

interface Props {
  coins: number;
  inventory: ElementType[];
  loadout: Loadout;
  onBuy: (element: ElementType) => void;
  onEquip: (slot: keyof Loadout, element: ElementType | null) => void;
  onClose: () => void;
  customElements?: Record<string, CustomElement>;
}

const ELEMENTS: { id: ElementType; name: string; color: string; cost: number }[] = [
  { id: 'fire', name: 'Fire', color: 'bg-red-500', cost: 100 },
  { id: 'water', name: 'Water', color: 'bg-blue-500', cost: 100 },
  { id: 'earth', name: 'Earth', color: 'bg-emerald-600', cost: 100 },
  { id: 'air', name: 'Air', color: 'bg-slate-300', cost: 100 },
];

const SLOTS: { id: keyof Loadout; name: string }[] = [
  { id: 'attack', name: 'Attack' },
  { id: 'defense', name: 'Defense' },
  { id: 'mobility', name: 'Mobility' },
  { id: 'healing', name: 'Healing' },
  { id: 'ultimate', name: 'Ultimate' },
];

export default function Builder({ coins, inventory, loadout, onBuy, onEquip, onClose, customElements = {} }: Props) {
  const [draggedElement, setDraggedElement] = useState<ElementType | null>(null);
  const [selectedElement, setSelectedElement] = useState<ElementType | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const handleDragStart = (e: React.DragEvent, element: ElementType) => {
    setDraggedElement(element);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, slotId: keyof Loadout) => {
    e.preventDefault();
    if (draggedElement) {
      onEquip(slotId, draggedElement);
      setDraggedElement(null);
      setSelectedElement(null);
    }
  };

  const handleElementClick = (element: ElementType) => {
    if (inventory.includes(element)) {
      setSelectedElement(selectedElement === element ? null : element);
    }
  };

  const handleSlotClick = (slotId: keyof Loadout) => {
    if (selectedElement) {
      onEquip(slotId, selectedElement);
      setSelectedElement(null);
    }
  };

  const handleRemove = (slotId: keyof Loadout) => {
    onEquip(slotId, null);
  };

  const getElementDetails = (id: ElementType) => {
    const base = ELEMENTS.find(e => e.id === id);
    if (base) return { ...base, tier: 1 };
    const custom = customElements[id];
    if (custom) return { id: custom.id, name: custom.name, color: custom.color, cost: 0, tier: custom.tier };
    return null;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900/80 border border-slate-600 rounded-2xl shadow-2xl backdrop-blur-md w-full max-w-4xl flex flex-col overflow-hidden max-h-full">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 md:p-6 border-b border-slate-700/50 bg-slate-800/50 shrink-0">
          <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Tactical Builder
          </h2>
          <div className="flex items-center gap-4 md:gap-6">
            <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 md:px-4 md:py-2 rounded-xl border border-slate-700">
              <span className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-wider">Balance</span>
              <span className="text-xl md:text-2xl font-black text-yellow-400">{coins}</span>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white font-bold transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 p-4 md:p-6 gap-6 md:gap-8 overflow-y-auto min-h-0 pb-24 touch-pan-y overscroll-contain">
          
          {/* Left Panel: Shop & Inventory */}
          <div className="flex-1 flex flex-col gap-6">
            <div>
              <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-500 rounded-full"></span>
                Base Elements (Tier 1)
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {ELEMENTS.map(el => {
                  const owned = inventory.includes(el.id);
                  const canAfford = coins >= el.cost;
                  const isSelected = selectedElement === el.id;
                  
                  return (
                    <div 
                      key={el.id} 
                      onClick={() => handleElementClick(el.id)}
                      className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col items-center gap-3 transition-transform hover:scale-105 ${isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700'}`}
                    >
                      <div 
                        className={`w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black text-white/90 ${el.color} ${owned ? 'cursor-grab active:cursor-grabbing ring-2 ring-white/50' : 'opacity-50 grayscale'} ${isSelected ? 'ring-4 ring-blue-400' : ''}`}
                        draggable={!isTouch && owned}
                        onDragStart={(e) => !isTouch && owned && handleDragStart(e, el.id)}
                      >
                        {el.name[0]}
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-slate-200">{el.name}</div>
                        {!owned ? (
                          <button 
                            onClick={(e) => { e.stopPropagation(); onBuy(el.id); }}
                            disabled={!canAfford}
                            className={`mt-2 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${canAfford ? 'bg-yellow-500 hover:bg-yellow-400 text-yellow-950' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}
                          >
                            Buy ({el.cost})
                          </button>
                        ) : (
                          <div className="mt-2 px-4 py-1.5 rounded-lg text-sm font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Owned
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {Object.values(customElements).some(el => inventory.includes(el.id)) && (
              <div className="mt-4">
                <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
                  <span className="w-2 h-6 bg-purple-500 rounded-full"></span>
                  Forged Elements
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.values(customElements).map(el => {
                    const owned = inventory.includes(el.id);
                    if (!owned) return null; // Only show owned custom elements
                    const isSelected = selectedElement === el.id;
                    
                    return (
                      <div 
                        key={el.id} 
                        onClick={() => handleElementClick(el.id)}
                        className={`bg-slate-800/60 border rounded-xl p-4 flex flex-col items-center gap-3 transition-transform hover:scale-105 ${isSelected ? 'border-purple-500 bg-purple-500/10' : 'border-purple-900/50'}`}
                      >
                        <div 
                          className={`w-16 h-16 rounded-2xl shadow-lg flex items-center justify-center text-2xl font-black text-white/90 ${el.color} cursor-grab active:cursor-grabbing ring-2 ring-white/50 ${isSelected ? 'ring-4 ring-purple-400' : ''}`}
                          draggable={!isTouch}
                          onDragStart={(e) => !isTouch && handleDragStart(e, el.id)}
                        >
                          {el.name[0]}
                        </div>
                        <div className="text-center w-full">
                          <div className="font-bold text-slate-200 truncate" title={el.name}>{el.name}</div>
                          <div className="text-xs text-purple-400 mt-1">Tier {el.tier}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="mt-auto bg-slate-800/40 border border-slate-700/50 rounded-xl p-4">
              <p className="text-sm text-slate-400 text-center">
                Drag elements, or tap to select then tap a slot, to equip them.
              </p>
            </div>
          </div>

          {/* Right Panel: Loadout */}
          <div className="flex-1 flex flex-col">
            <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-6 bg-emerald-500 rounded-full"></span>
              Tactical Loadout
            </h3>
            <div className="flex flex-col gap-4 flex-1">
              {SLOTS.map(slot => {
                const equippedId = loadout[slot.id];
                const equippedEl = equippedId ? getElementDetails(equippedId) : null;
                const isHighlight = draggedElement || selectedElement;
                
                return (
                  <div 
                    key={slot.id}
                    onClick={() => handleSlotClick(slot.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, slot.id)}
                    className={`flex-1 min-h-[80px] rounded-xl border-2 border-dashed flex items-center p-4 transition-colors ${isHighlight ? 'border-blue-500/50 bg-blue-500/5 cursor-pointer hover:bg-blue-500/20' : 'border-slate-600 bg-slate-800/30'}`}
                  >
                    <div className="w-24 font-bold text-slate-400 uppercase tracking-wider text-sm">
                      {slot.name}
                    </div>
                    
                    <div className="flex-1 flex justify-center">
                      {equippedEl ? (
                        <div className="flex items-center gap-4 bg-slate-800 border border-slate-600 rounded-xl p-2 pr-4 shadow-lg group">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-black text-white/90 ${equippedEl.color}`}>
                            {equippedEl.name[0]}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-200 truncate max-w-[120px]" title={equippedEl.name}>{equippedEl.name}</span>
                            {equippedEl.tier && equippedEl.tier > 1 && (
                              <span className="text-[10px] text-purple-400">Tier {equippedEl.tier}</span>
                            )}
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemove(slot.id); }}
                            className="ml-2 w-8 h-8 rounded-full bg-slate-700 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-slate-400 transition-colors md:opacity-0 md:group-hover:opacity-100 shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-sm font-medium italic">
                          {selectedElement ? 'Tap to equip' : 'Drop element here'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <button className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 mt-2">
                <span className="text-xl">🃏</span> Watch Ad for Wildcard Element
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
