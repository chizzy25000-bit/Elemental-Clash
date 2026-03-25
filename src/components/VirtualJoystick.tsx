import { useEffect, useRef, useState } from 'react';

interface Props {
  side: 'left' | 'right';
  onChange: (data: { x: number; y: number; active: boolean }) => void;
}

export default function VirtualJoystick({ side, onChange }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleTouch = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      e.preventDefault();
      if (!baseRef.current) return;
      
      const rect = baseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxDist = rect.width / 2;

      let found = false;
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const isLeft = t.clientX < window.innerWidth / 2;
        
        if ((side === 'left' && isLeft) || (side === 'right' && !isLeft)) {
          found = true;
          let dx = t.clientX - centerX;
          let dy = t.clientY - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
          }
          
          setPos({ x: dx, y: dy });
          
          // Normalize output between -1 and 1
          const normX = dx / maxDist;
          const normY = dy / maxDist;
          
          // For the right joystick, we only want to shoot if they pull it far enough
          const isActive = side === 'left' ? true : Math.sqrt(normX*normX + normY*normY) > 0.2;
          
          onChange({ x: normX, y: normY, active: isActive });
          setActive(true);
          break;
        }
      }
      
      if (!found && active) {
        setActive(false);
        setPos({ x: 0, y: 0 });
        onChange({ x: 0, y: 0, active: false });
      }
    };

    const handleEnd = (e: TouchEvent) => handleTouch(e);
    const handleMove = (e: TouchEvent) => handleTouch(e);
    const handleStart = (e: TouchEvent) => handleTouch(e);

    window.addEventListener('touchstart', handleStart, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleStart);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [side, active, onChange]);

  const positionClasses = side === 'left' ? 'left-8 bottom-8' : 'right-8 bottom-8';

  return (
    <div 
      ref={baseRef}
      className={`fixed ${positionClasses} w-32 h-32 bg-white/10 border-2 border-white/20 rounded-full z-50 pointer-events-none`}
    >
      <div 
        className="absolute w-12 h-12 bg-white/50 rounded-full shadow-lg transition-transform duration-75"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`
        }}
      />
    </div>
  );
}
