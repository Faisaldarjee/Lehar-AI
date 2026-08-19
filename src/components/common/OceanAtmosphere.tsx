import React, { useMemo, useEffect } from 'react';

export const OceanAtmosphere: React.FC = () => {
  // 14 sparse bioluminescent drifting organism particles
  const particles = useMemo(() => [
    { id: 1, left: '5%', size: 3, delay: '0s', duration: '34s', drift: '18px' },
    { id: 2, left: '14%', size: 2.5, delay: '6s', duration: '42s', drift: '-20px' },
    { id: 3, left: '24%', size: 3.5, delay: '14s', duration: '38s', drift: '12px' },
    { id: 4, left: '34%', size: 2, delay: '3s', duration: '48s', drift: '-16px' },
    { id: 5, left: '46%', size: 3, delay: '9s', duration: '36s', drift: '22px' },
    { id: 6, left: '56%', size: 2.5, delay: '17s', duration: '44s', drift: '-14px' },
    { id: 7, left: '67%', size: 4, delay: '2s', duration: '52s', drift: '18px' },
    { id: 8, left: '77%', size: 2, delay: '11s', duration: '40s', drift: '-24px' },
    { id: 9, left: '86%', size: 3, delay: '20s', duration: '46s', drift: '14px' },
    { id: 10, left: '94%', size: 2.5, delay: '7s', duration: '50s', drift: '-18px' },
    { id: 11, left: '40%', size: 2, delay: '25s', duration: '43s', drift: '-18px' },
    { id: 12, left: '71%', size: 3, delay: '18s', duration: '37s', drift: '15px' },
    { id: 13, left: '19%', size: 2.5, delay: '12s', duration: '41s', drift: '10px' },
    { id: 14, left: '82%', size: 3.2, delay: '4s', duration: '49s', drift: '-12px' },
  ], []);

  // Part 5: Signature micro-interaction — Water Ripple on Click
  useEffect(() => {
    const handleWaterRipple = (e: MouseEvent) => {
      // Create lightweight ripple element
      const ripple = document.createElement('div');
      ripple.className = 'water-ripple';
      ripple.style.left = `${e.clientX}px`;
      ripple.style.top = `${e.clientY}px`;
      document.body.appendChild(ripple);

      // Clean up from DOM after animation completes (500ms)
      setTimeout(() => {
        if (ripple.parentNode) {
          ripple.parentNode.removeChild(ripple);
        }
      }, 520);
    };

    window.addEventListener('click', handleWaterRipple, { passive: true });
    return () => window.removeEventListener('click', handleWaterRipple);
  }, []);

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none" 
      aria-hidden="true"
    >
      {/* 1. Part 1 — Subsurface Sonar Radar Sweep & Concentric Range Rings */}
      <div className="sonar-radar-bg">
        {/* Sonar Concentric Range Rings */}
        <div className="sonar-ring sonar-ring-1" />
        <div className="sonar-ring sonar-ring-2" />
        <div className="sonar-ring sonar-ring-3" />
        <div className="sonar-ring sonar-ring-4" />

        {/* Rotating Sonar Conic Sweep Beam */}
        <div className="sonar-sweep-conic" />
      </div>

      {/* 2. Subtle Caustic Refraction Light Layer (3-5% opacity) */}
      <div className="ocean-caustics" />

      {/* 3. Part 4 — Sparse Bioluminescent Floating Organisms */}
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

