import React from 'react';

interface HudCornerBracketsProps {
  className?: string;
  glow?: boolean;
}

export const HudCornerBrackets: React.FC<HudCornerBracketsProps> = ({ 
  className = '',
  glow = true 
}) => {
  const glowStyle = glow ? 'drop-shadow(0 0 5px rgba(34, 211, 238, 0.75))' : 'none';

  return (
    <div 
      className={`absolute inset-0 pointer-events-none z-20 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Top-Left Bracket */}
      <span 
        className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-400 rounded-tl-sm"
        style={{ filter: glowStyle }}
      />

      {/* Top-Right Bracket */}
      <span 
        className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-400 rounded-tr-sm"
        style={{ filter: glowStyle }}
      />

      {/* Bottom-Left Bracket */}
      <span 
        className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-400 rounded-bl-sm"
        style={{ filter: glowStyle }}
      />

      {/* Bottom-Right Bracket */}
      <span 
        className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-400 rounded-br-sm"
        style={{ filter: glowStyle }}
      />
    </div>
  );
};
