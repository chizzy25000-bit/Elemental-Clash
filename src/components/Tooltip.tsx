import React, { useState } from 'react';

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: Props) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div className="absolute z-[300] bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-slate-800 border border-slate-600 p-4 rounded-xl shadow-2xl text-sm text-slate-200 pointer-events-none animate-in fade-in zoom-in duration-200">
          {content}
        </div>
      )}
    </div>
  );
}
