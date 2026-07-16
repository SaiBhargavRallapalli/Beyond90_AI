'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Activity,
  Users,
  Leaf,
  BarChart3,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  ChevronDown,
  Shield,
  Stethoscope,
  Sparkles,
  Home,
} from 'lucide-react';
import type { OperationalAlert, VenueId } from '@/lib/types';
import CrowdBadge from '@/components/shared/CrowdBadge';
import { VENUES } from '@/components/shared/VenueSelector';

const INITIAL_ALERTS: OperationalAlert[] = [
  {
    id: 'alert-1',
    severity: 'critical',
    category: 'crowd',
    title: 'Gate A Crowd Spike — Immediate Action Required',
    description: 'Gate A (South Main Entry) at 94% capacity with inflow rate 3x outflow. Congestion index critical. Risk of bottleneck within 8 minutes.',
    affectedNodes: ['gate_a', 'lower_south'],
    recommendedActions: ['Divert fans to Gate C and Gate D', 'Deploy 4 additional ushers to Gate A', 'Activate PA announcement for alternate entry'],
    timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
    acknowledged: false,
    aiGenerated: true,
  },
  {
    id: 'alert-2',
    severity: 'warning',
    category: 'safety',
    title: 'Medical Request — Section 115, Row J',
    description: 'Fan reported feeling unwell near Section 115, Row J, Seat 22. EMT unit dispatched. First aid station at Lower East is closest (2 min walk).',
    affectedNodes: ['lower_east', 'field_east'],
    recommendedActions: ['EMT unit en route from Lower East', 'Clear path through Gate C concourse', 'Notify stadium medical coordinator'],
    timestamp: new Date(Date.now() - 7 * 60000).toISOString(),
    acknowledged: false,
    aiGenerated: true,
  },
  {
    id: 'alert-3',
    severity: 'warning',
    category: 'infrastructure',
    title: 'Escalator E2 — West Concourse Out of Service',
    description: 'Escalator E2 connecting Lower Concourse West to Upper Level reported non-operational by maintenance. Elevator W-3 capacity may be strained.',
    affectedNodes: ['lower_west', 'upper_west'],
    recommendedActions: ['Route mobility-impaired fans to Elevator W-4', 'Add signage at Lower Concourse West junction', 'Maintenance team dispatched — ETA 20 mins'],
    timestamp: new Date(Date.now() - 14 * 60000).toISOString(),
    acknowledged: true,
    aiGenerated: false,
  },
  {
    id: 'alert-4',
    severity: 'info',
    category: 'sustainability',
    title: 'Recycling Station C at 88% Capacity',
    description: 'Recycling station near Main Food Court is approaching capacity. Estimated 35 minutes until full. Waste management team should be dispatched proactively.',
    affectedNodes: ['food_main'],
    recommendedActions: ['Dispatch waste collection team to food court area', 'Consider temporary overflow bins near lower south'],
    timestamp: new Date(Date.now() - 22 * 60000).toISOString(),
    acknowledged: false,
    aiGenerated: true,
  },
  {
    id: 'alert-5',
    severity: 'warning',
    category: 'transport',
    title: 'NJ Transit Shuttle Queue — 45+ Min Wait',
    description: 'Transit hub queue has extended to 340+ fans with 45-minute estimated wait. Pre-match shuttle capacity insufficient for current arrival rate.',
    affectedNodes: ['transit_hub', 'gate_a'],
    recommendedActions: ['Request 2 additional shuttle buses from NJ Transit', 'Open overflow waiting area at South Exterior parking', 'Update fan app with live queue times'],
    timestamp: new Date(Date.now() - 31 * 60000).toISOString(),
    acknowledged: false,
    aiGenerated: true,
  },
];

const MOCK_STAFF = [
  { id: 's1', name: 'Rivera, M.',  role: 'supervisor' as const, location: 'Gate A South',       status: 'deployed' as const },
  { id: 's2', name: 'Chen, L.',    role: 'security'  as const, location: 'Lower Concourse East', status: 'available' as const },
  { id: 's3', name: 'Okafor, J.',  role: 'medic'     as const, location: 'First Aid – Lower East', status: 'deployed' as const },
  { id: 's4', name: 'Patel, A.',   role: 'usher'     as const, location: 'Gate C Turnstiles',   status: 'available' as const },
  { id: 's5', name: 'Kowalski, D.',role: 'security'  as const, location: 'Upper Concourse East', status: 'break' as const },
  { id: 's6', name: 'Santos, R.',  role: 'usher'     as const, location: 'Gate B North Entry',  status: 'available' as const },
  { id: 's7', name: 'Kim, S.',     role: 'medic'     as const, location: 'Field Level East',     status: 'emergency' as const },
  { id: 's8', name: 'Müller, T.',  role: 'cleaning'  as const, location: 'Main Food Court',     status: 'deployed' as const },
  { id: 's9', name: 'Nguyen, B.',  role: 'supervisor' as const, location: 'Ops Command Center', status: 'available' as const },
  { id: 's10',name: 'Al-Farsi, H.',role: 'usher'     as const, location: 'Gate D West Entry',   status: 'available' as const },
];

const METLIFE_SVG_NODES = [
  { id: 'gate_a',      label: 'Gate A',     x: 50, y: 90, congestion: 0.94 },
  { id: 'gate_b',      label: 'Gate B',     x: 50, y: 10, congestion: 0.38 },
  { id: 'gate_c',      label: 'Gate C',     x: 90, y: 50, congestion: 0.52 },
  { id: 'gate_d',      label: 'Gate D',     x: 10, y: 50, congestion: 0.41 },
  { id: 'transit_hub', label: 'Transit',    x: 50, y: 97, congestion: 0.79 },
  { id: 'lower_south', label: 'L-South',   x: 50, y: 75, congestion: 0.88 },
  { id: 'lower_north', label: 'L-North',   x: 50, y: 25, congestion: 0.35 },
  { id: 'lower_east',  label: 'L-East',    x: 75, y: 50, congestion: 0.61 },
  { id: 'lower_west',  label: 'L-West',    x: 25, y: 50, congestion: 0.44 },
  { id: 'food_main',   label: 'Food Hall', x: 50, y: 63, congestion: 0.72 },
  { id: 'upper_east',  label: 'U-East',    x: 81, y: 50, congestion: 0.33 },
  { id: 'upper_west',  label: 'U-West',    x: 19, y: 50, congestion: 0.29 },
  { id: 'field_east',  label: 'Field E',   x: 61, y: 50, congestion: 0.48 },
  { id: 'field_west',  label: 'Field W',   x: 39, y: 50, congestion: 0.45 },
  { id: 'vip_club',    label: 'VIP Club',  x: 70, y: 36, congestion: 0.25 },
  { id: 'press_north', label: 'Press',     x: 50, y: 20, congestion: 0.18 },
];

const OPS_QUERIES = [
  { label: '📊 Analyze crowd flow',          prompt: 'Analyze the current crowd flow across all venue nodes and identify the top 3 bottlenecks.' },
  { label: '👮 Deployment recommendations', prompt: 'Based on current crowd data and active alerts, provide staff deployment recommendations.' },
  { label: '🚨 Evacuation scenarios',        prompt: 'Generate and evaluate evacuation scenarios for the current crowd distribution.' },
  { label: '🌱 Sustainability report',       prompt: 'Provide a sustainability metrics summary for this match including energy, waste, and transport data.' },
];

function congestionColor(c: number): string {
  if (c < 0.4) return '#00D4AA';
  if (c < 0.65) return '#C9A84C';
  if (c < 0.85) return '#F97316';
  return '#C41E3A';
}

function congestionLevel(c: number): 'low' | 'moderate' | 'high' | 'critical' {
  if (c < 0.4) return 'low';
  if (c < 0.65) return 'moderate';
  if (c < 0.85) return 'high';
  return 'critical';
}

function severityColor(s: string) {
  const map: Record<string, string> = {
    info: 'text-blue-400 bg-blue-500/10 border-blue-500/25',
    warning: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25',
    critical: 'text-orange-400 bg-orange-500/10 border-orange-500/25',
    emergency: 'text-stadium-400 bg-stadium-500/10 border-stadium-500/25',
  };
  return map[s] ?? map.info;
}

function severityIcon(s: string) {
  if (s === 'info') return <Activity size={12} />;
  if (s === 'warning') return <AlertTriangle size={12} />;
  if (s === 'critical') return <AlertTriangle size={12} />;
  return <Shield size={12} />;
}

function staffStatusColor(s: string) {
  const map: Record<string, string> = {
    available: 'text-emerald-400 bg-emerald-500/10',
    deployed: 'text-blue-400 bg-blue-500/10',
    break: 'text-yellow-400 bg-yellow-500/10',
    emergency: 'text-stadium-400 bg-stadium-500/15',
  };
  return map[s] ?? '';
}

function roleIcon(r: string) {
  const map: Record<string, React.ReactNode> = {
    security: <Shield size={12} />,
    usher: <Users size={12} />,
    medic: <Stethoscope size={12} />,
    cleaning: <Leaf size={12} />,
    supervisor: <BarChart3 size={12} />,
  };
  return map[r] ?? <Users size={12} />;
}

function formatRelativeTime(timestamp: string) {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 min ago';
  return `${diff} mins ago`;
}

function StatCard({
  label, value, unit, icon, color, subtitle,
}: {
  label: string; value: string | number; unit?: string; icon: React.ReactNode; color: string; subtitle?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary-400 uppercase tracking-wider">{label}</span>
        <span className={`${color}`}>{icon}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-black ${color}`}>{value}</span>
        {unit && <span className="text-sm font-semibold text-primary-400 mb-0.5">{unit}</span>}
      </div>
      {subtitle && <p className="text-xs text-primary-500">{subtitle}</p>}
    </div>
  );
}

export default function OpsPage() {
  const [venueId, setVenueId] = useState<VenueId>('metlife');
  const [minutesToKickoff, setMinutesToKickoff] = useState(45);
  const [alerts, setAlerts] = useState<OperationalAlert[]>(INITIAL_ALERTS);
  const [advisorMessages, setAdvisorMessages] = useState<{ query: string; response: string; loading: boolean }[]>([]);
  const [advisorInput, setAdvisorInput] = useState('');
  const [heatmapNodes, setHeatmapNodes] = useState(METLIFE_SVG_NODES);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const advisorEndRef = useRef<HTMLDivElement>(null);

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;

  const attendance = 71240;
  const capacity = 82500;
  const capacityPct = Math.round((attendance / capacity) * 100);
  const sustainabilityScore = 78;

  useEffect(() => {
    const timer = setInterval(() => {
      setMinutesToKickoff((m) => m - 1);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeatmapNodes((nodes) =>
        nodes.map((n) => ({
          ...n,
          congestion: Math.max(0, Math.min(1, n.congestion + (Math.random() - 0.48) * 0.05)),
        }))
      );
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    advisorEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [advisorMessages]);

  const acknowledgeAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  };

  const sendOpsQuery = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      const entry = { query: query.trim(), response: '', loading: true };
      setAdvisorMessages((prev) => [...prev, entry]);
      setAdvisorInput('');

      try {
        const res = await fetch('/api/ops', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), venueId }),
        });
        const data = await res.json();
        setAdvisorMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, response: data.analysis ?? data.response ?? 'No response received.', loading: false }
              : m
          )
        );
      } catch {
        setAdvisorMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, response: 'Unable to reach AI service. Please verify your API configuration.', loading: false }
              : m
          )
        );
      }
    },
    [venueId]
  );

  const kickoffDisplay =
    minutesToKickoff > 0
      ? `T-${minutesToKickoff}m`
      : minutesToKickoff === 0
      ? 'KICKOFF'
      : `+${Math.abs(minutesToKickoff)}m`;

  const venueLabel = VENUES.find((v) => v.id === venueId)?.name ?? '';

  return (
    <div className="min-h-screen bg-primary-950 text-primary-100" role="region" aria-label="Operations Center dashboard">
      <header className="sticky top-0 z-30 border-b border-primary-800/50 glass-dark">
        <div className="flex items-center gap-3 px-4 h-14">
          <nav aria-label="Site navigation" className="flex items-center gap-2">
            <Link href="/" aria-label="Beyond90 AI home" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center" aria-hidden="true">
                <span className="text-primary-900 font-black text-xs">B9</span>
              </div>
              <Home size={14} className="text-primary-400" aria-hidden="true" />
            </Link>
          </nav>
          <div className="h-4 w-px bg-primary-700" aria-hidden="true" />
          <BarChart3 size={16} className="text-accent-400" aria-hidden="true" />
          <h1 className="text-sm font-bold text-white">Operations Center</h1>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="relative">
              <label htmlFor="select-ops-venue" className="sr-only">Select venue</label>
              <select
                id="select-ops-venue"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value as VenueId)}
                className="text-xs px-3 py-1.5 pr-7 rounded-lg appearance-none bg-primary-800/60 border border-primary-700/40"
              >
                {VENUES.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-primary-400" aria-hidden="true" />
            </div>

            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${minutesToKickoff <= 0 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-accent-500/30 text-accent-400 bg-accent-500/10'}`}>
              <Clock size={12} />
              {kickoffDisplay}
            </div>

            {unacknowledgedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stadium-500/30 text-stadium-400 bg-stadium-500/10 text-xs font-bold">
                <AlertTriangle size={12} />
                {unacknowledgedCount} alerts
                {criticalCount > 0 && (
                  <span className="ml-0.5 px-1 py-0.5 rounded bg-stadium-500/30 text-stadium-300 text-xs animate-pulse">
                    {criticalCount} critical
                  </span>
                )}
              </div>
            )}

            <Link
              href="/fan"
              aria-label="Go to Fan Hub"
              className="text-xs text-primary-400 hover:text-white border border-primary-700/40 rounded-lg px-3 py-1.5 transition-colors"
            >
              Fan Hub
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Attendance"
            value={attendance.toLocaleString()}
            icon={<Users size={18} />}
            color="text-emerald-400"
            subtitle={`${capacityPct}% of capacity`}
          />
          <StatCard
            label="Capacity %"
            value={capacityPct}
            unit="%"
            icon={<Activity size={18} />}
            color={capacityPct >= 90 ? 'text-stadium-400' : capacityPct >= 75 ? 'text-orange-400' : 'text-emerald-400'}
            subtitle={capacityPct >= 90 ? 'Near capacity' : 'Nominal'}
          />
          <StatCard
            label="Active Alerts"
            value={unacknowledgedCount}
            icon={<AlertTriangle size={18} />}
            color={unacknowledgedCount > 3 ? 'text-stadium-400' : unacknowledgedCount > 1 ? 'text-orange-400' : 'text-yellow-400'}
            subtitle={`${criticalCount} critical`}
          />
          <StatCard
            label="Sustainability Score"
            value={sustainabilityScore}
            unit="/100"
            icon={<Leaf size={18} />}
            color={sustainabilityScore >= 80 ? 'text-emerald-400' : sustainabilityScore >= 60 ? 'text-yellow-400' : 'text-orange-400'}
            subtitle="Grade B — Good"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 glass rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-white">Live Crowd Heatmap</h2>
                <p className="text-xs text-primary-400">{venueLabel} &bull; Updates every 30s</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-primary-500">
                  {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <RefreshCw size={12} className="text-primary-500" />
              </div>
            </div>

            <div className="relative w-full" style={{ paddingBottom: '70%' }}>
              <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label="Stadium crowd density heatmap showing congestion levels across venue zones"
                className="absolute inset-0 w-full h-full"
                style={{ background: 'rgba(10,22,40,0.4)', borderRadius: '12px' }}
              >
                <title>Stadium crowd density heatmap</title>
                <ellipse cx="50" cy="50" rx="46" ry="42" fill="none" stroke="rgba(138,155,181,0.15)" strokeWidth="0.5" />
                <ellipse cx="50" cy="50" rx="36" ry="32" fill="none" stroke="rgba(138,155,181,0.1)" strokeWidth="0.4" />
                <rect x="28" y="34" width="44" height="32" rx="2" fill="rgba(0,212,170,0.04)" stroke="rgba(0,212,170,0.15)" strokeWidth="0.4" />
                <line x1="50" y1="34" x2="50" y2="66" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
                <circle cx="50" cy="50" r="5" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.3" />
                <circle cx="50" cy="50" r="0.8" fill="rgba(255,255,255,0.2)" />

                {heatmapNodes.map((node) => {
                  const color = congestionColor(node.congestion);
                  const isHovered = hoveredNode === node.id;
                  const radius = isHovered ? 4 : 2.8;
                  return (
                    <g
                      key={node.id}
                      role="img"
                      aria-label={`${node.label}: ${Math.round(node.congestion * 100)}% congested`}
                      tabIndex={0}
                      onFocus={() => setHoveredNode(node.id)}
                      onBlur={() => setHoveredNode(null)}
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius + 2}
                        fill={color}
                        opacity={0.15}
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill={color}
                        opacity={0.85}
                        style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                      />
                      {isHovered && (
                        <g>
                          <rect
                            x={node.x > 60 ? node.x - 28 : node.x + 5}
                            y={node.y - 10}
                            width={24}
                            height={10}
                            rx="1.5"
                            fill="rgba(10,22,40,0.9)"
                            stroke="rgba(201,168,76,0.3)"
                            strokeWidth="0.3"
                          />
                          <text
                            x={node.x > 60 ? node.x - 16 : node.x + 17}
                            y={node.y - 4}
                            textAnchor="middle"
                            fontSize="2.5"
                            fill="white"
                          >
                            {node.label}
                          </text>
                          <text
                            x={node.x > 60 ? node.x - 16 : node.x + 17}
                            y={node.y - 0.5}
                            textAnchor="middle"
                            fontSize="2"
                            fill={color}
                          >
                            {Math.round(node.congestion * 100)}% congested
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center gap-4 mt-4 flex-wrap">
              {[
                { label: 'Low (<40%)',    color: '#00D4AA' },
                { label: 'Moderate (40–65%)', color: '#C9A84C' },
                { label: 'High (65–85%)', color: '#F97316' },
                { label: 'Critical (85%+)', color: '#C41E3A' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-xs text-primary-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white">Active Alerts</h2>
              <span className="text-xs text-primary-400">{alerts.length} total</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 max-h-[420px]">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl p-3.5 border transition-opacity ${alert.acknowledged ? 'opacity-50' : ''} ${severityColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${severityColor(alert.severity)}`}>
                        {severityIcon(alert.severity)}
                        {alert.severity.toUpperCase()}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-700/50 text-primary-300 border border-primary-600/30">
                        {alert.category}
                      </span>
                      {alert.aiGenerated && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-emerald-400">
                          <Sparkles size={10} />AI
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-primary-500 flex-shrink-0">{formatRelativeTime(alert.timestamp)}</span>
                  </div>

                  <p className="text-xs font-semibold text-white mb-1">{alert.title}</p>
                  <p className="text-xs text-primary-300 leading-relaxed mb-3">{alert.description}</p>

                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 rounded-lg px-2.5 py-1 transition-colors"
                    >
                      <CheckCircle2 size={12} />
                      Acknowledge
                    </button>
                  )}
                  {alert.acknowledged && (
                    <span className="flex items-center gap-1 text-xs text-primary-500">
                      <CheckCircle2 size={11} /> Acknowledged
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-emerald-400" />
              <h2 className="text-sm font-bold text-white">AI Ops Advisor</h2>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="pulse-live" />
                <span className="text-xs text-emerald-400 font-medium">Beyond90 AI</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {OPS_QUERIES.map((q) => (
                <button
                  key={q.label}
                  onClick={() => sendOpsQuery(q.prompt)}
                  className="text-left text-xs px-3 py-2 rounded-lg border border-primary-700/40 hover:border-accent-500/30 hover:bg-primary-800/40 text-primary-300 hover:text-white transition-all leading-snug"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <div
              className="flex-1 overflow-y-auto space-y-4 min-h-[200px] max-h-[280px] mb-4"
              aria-live="polite"
              aria-label="AI advisor responses"
              role="log"
            >
              {advisorMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <BarChart3 size={28} className="text-primary-600 mb-2" />
                  <p className="text-xs text-primary-500">Select a quick query or type a custom ops question below</p>
                </div>
              )}
              {advisorMessages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-tr-sm bg-primary-700/50 border border-primary-600/30 text-xs text-primary-200">
                      {m.query}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500/30 to-primary-700 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                      B9
                    </div>
                    <div className="flex-1 glass rounded-xl rounded-tl-sm px-3 py-2 text-xs text-primary-200 leading-relaxed">
                      {m.loading ? (
                        <div className="flex items-center gap-2 text-primary-400">
                          <div className="flex gap-1">
                            {[0, 1, 2].map((j) => (
                              <span
                                key={j}
                                className="w-1.5 h-1.5 bg-emerald-400/60 rounded-full animate-bounce"
                                style={{ animationDelay: `${j * 150}ms` }}
                              />
                            ))}
                          </div>
                          Analyzing with AI...
                        </div>
                      ) : (
                        m.response
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={advisorEndRef} />
            </div>

            <div className="flex gap-2">
              <label htmlFor="ops-advisor-input" className="sr-only">Ask the operations AI advisor</label>
              <input
                id="ops-advisor-input"
                type="text"
                value={advisorInput}
                onChange={(e) => setAdvisorInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendOpsQuery(advisorInput)}
                placeholder="Ask the ops AI anything..."
                className="flex-1 text-xs px-3 py-2 rounded-lg"
              />
              <button
                onClick={() => sendOpsQuery(advisorInput)}
                disabled={!advisorInput.trim()}
                aria-label="Send ops query"
                className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-primary-900 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={14} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-accent-400" />
                <h2 className="text-sm font-bold text-white">Staff Resources</h2>
              </div>
              <span className="text-xs text-primary-400">{MOCK_STAFF.length} personnel</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">Staff resources — name, role, location, and status for deployed personnel</caption>
                <thead>
                  <tr className="border-b border-primary-800/60">
                    <th className="text-left text-primary-400 font-semibold py-2 pr-3 uppercase tracking-wider text-xs">Name</th>
                    <th className="text-left text-primary-400 font-semibold py-2 pr-3 uppercase tracking-wider text-xs">Role</th>
                    <th className="text-left text-primary-400 font-semibold py-2 pr-3 uppercase tracking-wider text-xs hidden sm:table-cell">Location</th>
                    <th className="text-left text-primary-400 font-semibold py-2 uppercase tracking-wider text-xs">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-800/30">
                  {MOCK_STAFF.map((staff) => (
                    <tr key={staff.id} className="hover:bg-primary-800/20 transition-colors">
                      <td className="py-2.5 pr-3 text-primary-200 font-medium">{staff.name}</td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1 text-primary-300 capitalize">
                          <span className="text-primary-500">{roleIcon(staff.role)}</span>
                          {staff.role}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-primary-400 hidden sm:table-cell max-w-[140px] truncate">{staff.location}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${staffStatusColor(staff.status)}`}>
                          {staff.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                { label: 'Available', value: MOCK_STAFF.filter((s) => s.status === 'available').length, color: 'text-emerald-400' },
                { label: 'Deployed',  value: MOCK_STAFF.filter((s) => s.status === 'deployed').length,  color: 'text-blue-400' },
                { label: 'Break',     value: MOCK_STAFF.filter((s) => s.status === 'break').length,     color: 'text-yellow-400' },
                { label: 'Emergency', value: MOCK_STAFF.filter((s) => s.status === 'emergency').length, color: 'text-stadium-400' },
              ].map((item) => (
                <div key={item.label} className="text-center p-2 rounded-lg bg-primary-800/30">
                  <div className={`text-lg font-black ${item.color}`}>{item.value}</div>
                  <div className="text-xs text-primary-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-primary-800/30 py-4 px-4 text-center">
        <p className="text-xs text-primary-600">
          Beyond90 AI Ops Center &bull; {venueLabel} &bull; Powered by Beyond90 AI &bull; Data refreshes every 30s
        </p>
      </footer>
    </div>
  );
}
