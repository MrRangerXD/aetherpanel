import React, { useState, useMemo } from 'react';

interface UserAvatarProps {
  seed?: string;
  avatarUrl?: string;
  name?: string;
  sizeClass?: string;
  shape?: 'circle' | 'rounded';
  className?: string;
}

// Deterministic FNV-1a 32-bit hash for consistent per-user GitHub-style identicons
function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const IDENTICON_PALETTE = [
  '#f97316', // Orange
  '#38bdf8', // Sky
  '#34d399', // Emerald
  '#a78bfa', // Violet
  '#fb7185', // Rose
  '#facc15', // Amber
  '#22d3ee', // Cyan
  '#818cf8', // Indigo
  '#4ade80', // Green
  '#f472b6', // Pink
];

function isCustomUploadedAvatar(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Treat default system placeholders (dicebear / default admin unsplash photo) as auto-identicon
  if (trimmed.includes('api.dicebear.com')) return false;
  if (trimmed.includes('photo-1534528741775-53994a69daeb')) return false;
  return true;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  seed,
  avatarUrl,
  name,
  sizeClass = 'w-8 h-8',
  shape = 'rounded',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const normalizedSeed = (seed || name || 'aether-user').trim().toLowerCase();

  const { fgColor, bgTint, grid } = useMemo(() => {
    const h1 = hashSeed(normalizedSeed);
    const h2 = hashSeed(`${normalizedSeed}:grid`);
    const fg = IDENTICON_PALETTE[h1 % IDENTICON_PALETTE.length];

    // Generate 5x5 symmetrical matrix (columns 0, 1, 2 mirrored to 4, 3)
    const cells: boolean[][] = [];
    let activeCount = 0;
    for (let row = 0; row < 5; row++) {
      const rowCells = [false, false, false, false, false];
      for (let col = 0; col < 3; col++) {
        const bitIndex = row * 3 + col;
        const hashVal = bitIndex < 10 ? h1 >>> (bitIndex * 2) : h2 >>> ((bitIndex - 10) * 3);
        const on = (hashVal & 1) === 1;
        rowCells[col] = on;
        rowCells[4 - col] = on;
        if (on) activeCount += col === 2 ? 1 : 2;
      }
      cells.push(rowCells);
    }

    // Ensure enough visual density (never an empty/sparse identicon)
    if (activeCount < 9) {
      cells[1][1] = true;
      cells[1][3] = true;
      cells[2][2] = true;
      cells[3][1] = true;
      cells[3][3] = true;
    }

    return {
      fgColor: fg,
      bgTint: `${fg}1c`,
      grid: cells,
    };
  }, [normalizedSeed]);

  const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg';
  const showCustomImage = !imgFailed && isCustomUploadedAvatar(avatarUrl);

  if (showCustomImage) {
    return (
      <div
        className={`${sizeClass} ${shapeClass} overflow-hidden border border-[#2a2d3a] bg-[#14151b] shrink-0 ${className}`}
      >
        <img
          src={avatarUrl}
          alt={name || 'User avatar'}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${shapeClass} overflow-hidden border border-[#2a2d3a] bg-[#151720] shrink-0 flex items-center justify-center relative select-none ${className}`}
      style={{ backgroundColor: '#14161f', boxShadow: `inset 0 0 12px ${bgTint}` }}
      aria-label={name ? `${name} avatar` : 'User identicon'}
    >
      <svg
        viewBox="0 0 7 7"
        className="w-full h-full"
        shapeRendering="crispEdges"
      >
        <rect width="7" height="7" fill="#14161f" />
        <rect width="7" height="7" fill={bgTint} />
        {grid.map((row, rIdx) =>
          row.map((active, cIdx) =>
            active ? (
              <rect
                key={`${rIdx}-${cIdx}`}
                x={cIdx + 1}
                y={rIdx + 1}
                width="1"
                height="1"
                fill={fgColor}
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
