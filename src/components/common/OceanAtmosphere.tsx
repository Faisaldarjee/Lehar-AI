import React, { useMemo } from 'react';

export const OceanAtmosphere: React.FC = () => {
  // 12 sparse bioluminescent drifting particles with randomized parameters
  const particles = useMemo(() => [
    { id: 1, left: '6%', size: 3, delay: '0s', duration: '36s', drift: '18px' },
    { id: 2, left: '16%', size: 2.5, delay: '6s', duration: '44s', drift: '-22px' },
    { id: 3, left: '26%', size: 3.5, delay: '14s', duration: '40s', drift: '12px' },
    { id: 4, left: '36%', size: 2, delay: '3s', duration: '50s', drift: '-16px' },
    { id: 5, left: '48%', size: 3, delay: '9s', duration: '38s', drift: '24px' },
    { id: 6, left: '58%', size: 2.5, delay: '17s', duration: '46s', drift: '-12px' },
    { id: 7, left: '69%', size: 4, delay: '2s', duration: '54s', drift: '20px' },
    { id: 8, left: '79%', size: 2, delay: '11s', duration: '42s', drift: '-25px' },
    { id: 9, left: '88%', size: 3, delay: '20s', duration: '48s', drift: '14px' },
    { id: 10, left: '95%', size: 2.5, delay: '7s', duration: '52s', drift: '-18px' },
    { id: 11, left: '42%', size: 2, delay: '25s', duration: '45s', drift: '-20px' },
    { id: 12, left: '73%', size: 3, delay: '18s', duration: '39s', drift: '15px' },
  ], []);

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" 
      aria-hidden="true"
    >
      {/* 1. Subtle Caustic Refraction Light Layer (4-6% max opacity) */}
      <div className="ocean-caustics" />

      {/* 2. Sparse Bioluminescent Drift Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="ocean-particle"
          style={{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            animationDelay: p.delay,
            animationDuration: p.duration,
            '--drift-x': p.drift,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
};
