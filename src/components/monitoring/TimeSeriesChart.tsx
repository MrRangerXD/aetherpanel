import React, { useState, useRef } from 'react';

interface DataPoint {
  timestamp: string;
  value: number;
  secondaryValue?: number;
}

interface TimeSeriesChartProps {
  title: string;
  data: DataPoint[];
  unit: string;
  color?: 'emerald' | 'amber' | 'sky' | 'rose' | 'purple';
  maxValue?: number;
  height?: number;
  secondaryLabel?: string;
  secondaryUnit?: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  data,
  unit,
  color = 'emerald',
  maxValue,
  height = 140,
  secondaryLabel,
  secondaryUnit
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return (
      <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center text-xs text-zinc-400 font-mono" style={{ height }}>
        No telemetry points recorded
      </div>
    );
  }

  // Calculate scaling
  const values = data.map(d => d.value);
  const minVal = Math.min(...values, 0);
  const maxVal = maxValue !== undefined ? maxValue : Math.max(...values, 10);
  const range = maxVal - minVal || 1;

  // Path generators
  const width = 500;
  const paddingX = 10;
  const paddingY = 15;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const points = data.map((d, idx) => {
    const x = paddingX + (idx / (data.length - 1 || 1)) * innerWidth;
    const normalizedY = (d.value - minVal) / range;
    const y = height - paddingY - normalizedY * innerHeight;
    return { x, y, data: d };
  });

  const svgPath = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaPath = points.length > 0
    ? `${svgPath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
    : '';

  const colorMap = {
    emerald: {
      stroke: '#10b981',
      fill: 'url(#grad-emerald)',
      glow: 'rgba(16, 185, 129, 0.35)',
      text: 'text-emerald-400'
    },
    amber: {
      stroke: '#f59e0b',
      fill: 'url(#grad-amber)',
      glow: 'rgba(245, 158, 11, 0.35)',
      text: 'text-amber-400'
    },
    sky: {
      stroke: '#38bdf8',
      fill: 'url(#grad-sky)',
      glow: 'rgba(56, 189, 248, 0.35)',
      text: 'text-sky-400'
    },
    rose: {
      stroke: '#f43f5e',
      fill: 'url(#grad-rose)',
      glow: 'rgba(244, 63, 94, 0.35)',
      text: 'text-rose-400'
    },
    purple: {
      stroke: '#a855f7',
      fill: 'url(#grad-purple)',
      glow: 'rgba(168, 85, 247, 0.35)',
      text: 'text-purple-400'
    }
  };

  const formatValue = (val: number) => {
    if (typeof val !== 'number' || isNaN(val)) return '0';
    if (val === 0) return '0';
    if (val < 0.01) return '< 0.01';
    if (val < 10 && val % 1 !== 0) return val.toFixed(2);
    if (val % 1 !== 0) return val.toFixed(1);
    return val.toString();
  };

  const currentVal = data[data.length - 1]?.value ?? 0;
  const activePoint = hoverIndex !== null ? points[hoverIndex] : null;
  const displayVal = activePoint ? activePoint.data.value : currentVal;

  return (
    <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-2 select-none hover:border-zinc-750 transition-colors shadow-lg" ref={containerRef}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-300">{title}</span>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <span className="text-zinc-400">Live:</span>
          <span className={`font-bold ${colorMap[color].text}`}>
            {formatValue(displayVal)} {unit}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden rounded-lg bg-zinc-950/90 border border-zinc-850">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto block"
          onMouseMove={e => {
            if (!containerRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const normalizedX = mouseX / rect.width;
            const closestIdx = Math.min(
              data.length - 1,
              Math.max(0, Math.round(normalizedX * (data.length - 1)))
            );
            setHoverIndex(closestIdx);
          }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <filter id={`neon-glow-${color}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="grad-emerald" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-amber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-rose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="grad-purple" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1={paddingY} x2={width} y2={paddingY} stroke="#27272a" strokeDasharray="3 3" strokeWidth="0.8" />
          <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#27272a" strokeDasharray="3 3" strokeWidth="0.8" />
          <line x1="0" y1={height - paddingY} x2={width} y2={height - paddingY} stroke="#3f3f46" strokeWidth="1" />

          {/* Area Fill */}
          <path d={areaPath} fill={colorMap[color].fill} />

          {/* Glowing Line Stroke */}
          <path
            d={svgPath}
            fill="none"
            stroke={colorMap[color].stroke}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#neon-glow-${color})`}
          />

          {/* Active Hover Marker */}
          {activePoint && (
            <g>
              <line
                x1={activePoint.x}
                y1={paddingY}
                x2={activePoint.x}
                y2={height - paddingY}
                stroke="#a1a1aa"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5"
                fill="#ffffff"
                stroke={colorMap[color].stroke}
                strokeWidth="2.5"
                style={{ filter: `drop-shadow(0 0 6px ${colorMap[color].stroke})` }}
              />
            </g>
          )}
        </svg>

        {/* Hover timestamp popup */}
        {activePoint && (
          <div className="absolute bottom-1.5 right-2 px-2.5 py-1 rounded-md bg-zinc-900/95 border border-zinc-700 text-[10px] font-mono text-zinc-200 pointer-events-none shadow-xl flex items-center gap-1.5">
            <span className="text-zinc-400">{new Date(activePoint.data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            <span className="text-zinc-500">•</span>
            <span className={`font-bold ${colorMap[color].text}`}>{formatValue(activePoint.data.value)} {unit}</span>
          </div>
        )}
      </div>

      {/* Axis legend */}
      <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
        <span>{new Date(data[0].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="text-zinc-500">Cap: {formatValue(maxVal)} {unit}</span>
        <span>{new Date(data[data.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
};

export default TimeSeriesChart;
