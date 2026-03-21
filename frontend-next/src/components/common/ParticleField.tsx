'use client';

import React from 'react';

const PARTICLES = Array.from({ length: 48 }, (_, i) => ({
  x: (Math.sin(i * 1.618) * 0.5 + 0.5) * 100,
  y: (Math.cos(i * 2.399) * 0.5 + 0.5) * 100,
  size: (i % 5 === 0) ? 3 : (i % 3 === 0) ? 2 : 1.5,
  opacity: 0.1 + (i % 7) * 0.04,
  animDelay: `${(i * 0.37) % 4}s`,
  animDuration: `${3 + (i % 4)}s`,
}));

export function ParticleField() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full animate-float-slow"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: i % 3 === 0 ? 'var(--accent)' : i % 2 === 0 ? 'var(--primary)' : 'var(--nebula)',
            opacity: p.opacity,
            animationDelay: p.animDelay,
            animationDuration: p.animDuration,
          }}
        />
      ))}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {PARTICLES.slice(0, 12).map((p, i) => {
          const next = PARTICLES[(i + 3) % 12];
          return (
            <line
              key={i}
              x1={`${p.x}%`} y1={`${p.y}%`}
              x2={`${next.x}%`} y2={`${next.y}%`}
              stroke="var(--accent)"
              strokeWidth="0.5"
              strokeOpacity="0.08"
              strokeDasharray="4 8"
            />
          );
        })}
      </svg>
    </div>
  );
}
