'use client';

import { Users, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';

interface CrowdBadgeProps {
  level: 'low' | 'moderate' | 'high' | 'critical';
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const config = {
  low: {
    label: 'Low',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    dot: 'bg-emerald-400',
    icon: CheckCircle,
  },
  moderate: {
    label: 'Moderate',
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
    dot: 'bg-yellow-400',
    icon: TrendingUp,
  },
  high: {
    label: 'High',
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/30',
    dot: 'bg-orange-400',
    icon: Users,
  },
  critical: {
    label: 'Critical',
    bg: 'bg-stadium-600/20',
    text: 'text-stadium-400',
    border: 'border-stadium-500/40',
    dot: 'bg-stadium-500',
    icon: AlertTriangle,
  },
};

const sizes = {
  sm: {
    badge: 'px-2 py-0.5 text-xs gap-1.5',
    dot: 'w-1.5 h-1.5',
    icon: 12,
  },
  md: {
    badge: 'px-3 py-1 text-sm gap-2',
    dot: 'w-2 h-2',
    icon: 14,
  },
  lg: {
    badge: 'px-4 py-1.5 text-base gap-2.5',
    dot: 'w-2.5 h-2.5',
    icon: 16,
  },
};

export default function CrowdBadge({
  level,
  className = '',
  showIcon = true,
  size = 'md',
}: CrowdBadgeProps) {
  const c = config[level];
  const s = sizes[size];
  const Icon = c.icon;
  const isCritical = level === 'critical';

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-semibold',
        c.bg,
        c.text,
        c.border,
        s.badge,
        isCritical ? 'badge-critical' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {showIcon ? (
        <Icon size={s.icon} className="flex-shrink-0" />
      ) : (
        <span
          className={[
            'rounded-full flex-shrink-0',
            c.dot,
            s.dot,
            isCritical ? 'animate-pulse' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      )}
      {c.label}
    </span>
  );
}
