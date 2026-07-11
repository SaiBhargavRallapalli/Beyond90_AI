'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send,
  MapPin,
  Users,
  UtensilsCrossed,
  HeartPulse,
  LogOut,
  ChevronRight,
  RefreshCw,
  Settings2,
  Accessibility,
  Languages,
  Timer,
  Ticket,
  LayoutDashboard,
} from 'lucide-react';
import Link from 'next/link';
import type { ChatMessage, UserSession, VenueId, AccessibilityProfile, UserRole } from '@/lib/types';
import MessageBubble from '@/components/fan/MessageBubble';
import CrowdBadge from '@/components/shared/CrowdBadge';
import { VENUES } from '@/components/shared/VenueSelector';

const METLIFE_NODES = [
  { id: 'gate_a',      name: 'Gate A – South Main Entry' },
  { id: 'gate_b',      name: 'Gate B – North Entry' },
  { id: 'gate_c',      name: 'Gate C – East Entry' },
  { id: 'gate_d',      name: 'Gate D – West Entry' },
  { id: 'transit_hub', name: 'NJ Transit Shuttle Hub' },
  { id: 'lower_south', name: 'Lower Concourse South' },
  { id: 'lower_north', name: 'Lower Concourse North' },
  { id: 'lower_east',  name: 'Lower Concourse East' },
  { id: 'lower_west',  name: 'Lower Concourse West' },
  { id: 'food_main',   name: 'Main Food Court' },
  { id: 'upper_east',  name: 'Upper Concourse East' },
  { id: 'upper_west',  name: 'Upper Concourse West' },
  { id: 'field_east',  name: 'Field Level East Tunnel' },
  { id: 'field_west',  name: 'Field Level West Tunnel' },
  { id: 'vip_club',    name: 'MetLife Club – East Wing' },
  { id: 'press_north', name: 'Media & Press Center' },
];

const VENUE_NODES: Record<string, { id: string; name: string }[]> = {
  metlife:          METLIFE_NODES,
  sofi:             [
    { id: 'gate_1',        name: 'Gate 1 – South Main Entry' },
    { id: 'gate_2',        name: 'Gate 2 – North Entry' },
    { id: 'gate_3',        name: 'Gate 3 – East Entry' },
    { id: 'gate_4',        name: 'Gate 4 – West Entry' },
    { id: 'main_concourse',name: 'Main Concourse Ring' },
    { id: 'conc_south',    name: 'Concourse South Hub' },
    { id: 'conc_north',    name: 'Concourse North Hub' },
    { id: 'conc_east',     name: 'Concourse East Hub' },
    { id: 'conc_west',     name: 'Concourse West Hub' },
    { id: 'metro_plaza',   name: 'Metro Rail Plaza' },
  ],
  attdallas:        [
    { id: 'gate_a',     name: 'Gate A – East Main Entry' },
    { id: 'gate_b',     name: 'Gate B – West Entry' },
    { id: 'gate_c',     name: 'Gate C – North Entry' },
    { id: 'gate_d',     name: 'Gate D – South Entry' },
    { id: 'main_plaza', name: 'Main East Plaza' },
    { id: 'conc_east',  name: 'East Concourse' },
    { id: 'conc_west',  name: 'West Concourse' },
    { id: 'atrium',     name: 'Grand Atrium' },
  ],
  levis:            [
    { id: 'gate_a',     name: 'Gate A – South Entry' },
    { id: 'gate_b',     name: 'Gate B – North Entry' },
    { id: 'gate_c',     name: 'Gate C – East Entry' },
    { id: 'gate_d',     name: 'Gate D – West Entry' },
    { id: 'main_plaza', name: 'South Fan Plaza' },
    { id: 'conc_lower', name: 'Lower Concourse Ring' },
    { id: 'vta_plaza',  name: 'VTA Light Rail Plaza' },
  ],
  hardrock:         [
    { id: 'gate_1',     name: 'Gate 1 – South Entry' },
    { id: 'gate_2',     name: 'Gate 2 – North Entry' },
    { id: 'gate_3',     name: 'Gate 3 – East Entry' },
    { id: 'gate_4',     name: 'Gate 4 – West Entry' },
    { id: 'shade_deck', name: 'Shade Canopy Concourse' },
    { id: 'mia_grdn',   name: 'Miami Gardens Fan Zone' },
  ],
  mercedesbenz:     [
    { id: 'gate_1',    name: 'Gate 1 – NE Entry' },
    { id: 'gate_2',    name: 'Gate 2 – SE Entry' },
    { id: 'gate_3',    name: 'Gate 3 – South Entry' },
    { id: 'gate_4',    name: 'Gate 4 – SW Entry' },
    { id: 'gate_5',    name: 'Gate 5 – West Entry' },
    { id: 'halo_ring', name: 'Halo Board Concourse' },
    { id: 'marta_hub', name: 'MARTA Rail Hub' },
  ],
  lincolnfinancial: [
    { id: 'gate_a',     name: 'Gate A – Northeast Entry' },
    { id: 'gate_b',     name: 'Gate B – South Entry' },
    { id: 'gate_c',     name: 'Gate C – West Entry' },
    { id: 'gate_d',     name: 'Gate D – East Entry' },
    { id: 'conc_south', name: 'Main Concourse South' },
    { id: 'septa_hub',  name: 'SEPTA Broad St Hub' },
    { id: 'tailgate',   name: 'Tailgate & Fan Zone' },
  ],
  gillette:         [
    { id: 'gate_a',    name: 'Gate A – Main Entry' },
    { id: 'gate_b',    name: 'Gate B – South Entry' },
    { id: 'conc_main', name: 'Main Concourse' },
    { id: 'fan_plaza', name: 'Fan Plaza' },
  ],
};

const LANGUAGES = [
  { code: 'en',  label: 'English' },
  { code: 'es',  label: 'Español' },
  { code: 'fr',  label: 'Français' },
  { code: 'pt',  label: 'Português' },
  { code: 'ar',  label: 'العربية' },
  { code: 'de',  label: 'Deutsch' },
  { code: 'ja',  label: '日本語' },
  { code: 'ko',  label: '한국어' },
  { code: 'it',  label: 'Italiano' },
  { code: 'nl',  label: 'Nederlands' },
];

const QUICK_ACTIONS = [
  { icon: <MapPin size={14} />, label: 'Find nearest restroom',    message: 'Where is the nearest restroom from my current location?' },
  { icon: <Ticket size={14} />,  label: 'Navigate to my seat',     message: 'Help me navigate to my seat section.' },
  { icon: <UtensilsCrossed size={14} />, label: 'Food & drinks nearby', message: 'What food and drink options are closest to me right now?' },
  { icon: <HeartPulse size={14} />, label: 'First aid location',  message: 'Where is the nearest first aid station?' },
  { icon: <LogOut size={14} />,  label: 'Exit routes',             message: 'What are the best exit routes from my current position to avoid crowds?' },
];

const SUGGESTED_QUESTIONS = [
  'How crowded is Gate A right now?',
  'Find me an accessible restroom nearby',
  'What food options are open near Section 120?',
  'What time does the FIFA store close?',
  'Is there a sensory room in this venue?',
  'How long will it take to exit after the match?',
];

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildSession(
  venueId: VenueId,
  currentNodeId: string,
  role: UserRole,
  accessibilityProfile: AccessibilityProfile,
  language: string,
  minutesToKickoff: number,
  ticketSection: string
): UserSession {
  return {
    id: generateId(),
    role,
    venueId,
    currentNodeId,
    accessibilityProfile,
    language,
    ticketSection: ticketSection || undefined,
    minutesToKickoff,
  };
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-primary-700 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
        B9
      </div>
      <div className="glass rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-2 h-2 bg-accent-400 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function FanPage() {
  const [venueId, setVenueId] = useState<VenueId>('metlife');
  const [currentNodeId, setCurrentNodeId] = useState('gate_a');
  const [role, setRole] = useState<UserRole>('fan');
  const [accessibilityProfile, setAccessibilityProfile] = useState<AccessibilityProfile>('standard');
  const [language, setLanguage] = useState('en');
  const [minutesToKickoff, setMinutesToKickoff] = useState(45);
  const [ticketSection, setTicketSection] = useState('');

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [crowdLevel, setCrowdLevel] = useState<'low' | 'moderate' | 'high' | 'critical'>('moderate');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentNodes = VENUE_NODES[venueId] ?? METLIFE_NODES;

  useEffect(() => {
    const firstNode = (VENUE_NODES[venueId] ?? METLIFE_NODES)[0];
    setCurrentNodeId(firstNode.id);
  }, [venueId]);

  useEffect(() => {
    fetch('/api/crowd')
      .then((r) => r.json())
      .then((data) => {
        if (data?.level) setCrowdLevel(data.level);
      })
      .catch(() => {});
  }, [venueId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaiting]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      const assistantId = generateId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { toolsUsed: [] },
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText('');
      setIsWaiting(true);
      setIsStreaming(false);

      const session = buildSession(
        venueId,
        currentNodeId,
        role,
        accessibilityProfile,
        language,
        minutesToKickoff,
        ticketSection
      );

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch('/api/assist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session,
            message: text.trim(),
            history: messages.slice(-8),
          }),
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        setIsWaiting(false);
        setIsStreaming(true);
        setMessages((prev) => [...prev, assistantMessage]);

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No response body');

        let buffer = '';
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            if (data.startsWith('[METADATA]')) {
              try {
                const metaStr = data.slice(10);
                const meta = JSON.parse(metaStr);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, metadata: { ...m.metadata, toolsUsed: meta.toolsUsed ?? [], crowdAlert: meta.crowdWarning ? { level: 'high', message: meta.crowdWarning } : undefined } }
                      : m
                  )
                );
              } catch {}
              continue;
            }

            accumulatedText += data;
            const snapshot = accumulatedText;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: snapshot } : m
              )
            );
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setIsWaiting(false);
        const errorMessage: ChatMessage = {
          id: generateId(),
          role: 'assistant',
          content: 'I encountered an issue connecting to the AI service. Please check your setup and try again.',
          timestamp: new Date().toISOString(),
          metadata: { toolsUsed: [] },
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsStreaming(false);
        setIsWaiting(false);
      }
    },
    [venueId, currentNodeId, role, accessibilityProfile, language, minutesToKickoff, ticketSection, messages, isStreaming]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleQuickAction = (message: string) => {
    sendMessage(message);
  };

  const venueLabel = VENUES.find((v) => v.id === venueId)?.name ?? 'MetLife Stadium';

  return (
    <div className="h-screen flex flex-col bg-primary-950 text-primary-100">
      <header className="flex-shrink-0 h-14 border-b border-primary-800/50 glass-dark flex items-center px-4 gap-3 z-20">
        <Link href="/" className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
            <span className="text-primary-900 font-black text-xs">B9</span>
          </div>
          <span className="text-white font-bold text-sm hidden sm:block">Beyond90 AI</span>
        </Link>
        <div className="h-4 w-px bg-primary-700" />
        <div className="flex items-center gap-2">
          <span className="pulse-live" />
          <span className="text-xs font-semibold text-emerald-400">Live</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <CrowdBadge level={crowdLevel} size="sm" />
          <Link href="/ops">
            <button className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-white border border-primary-700/50 rounded-lg px-3 py-1.5 transition-colors">
              <LayoutDashboard size={13} />
              <span className="hidden sm:block">Ops Center</span>
            </button>
          </Link>
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-primary-400 hover:text-white border border-primary-700/50 rounded-lg px-3 py-1.5 transition-colors md:hidden"
          >
            <Settings2 size={13} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${sidebarOpen ? 'w-72 min-w-[18rem]' : 'w-0 min-w-0 overflow-hidden'} flex-shrink-0 border-r border-primary-800/40 bg-primary-950/80 flex flex-col transition-all duration-300 md:w-72 md:min-w-[18rem] md:overflow-visible`}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Settings2 size={14} className="text-accent-400" />
                <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">Session Setup</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin size={11} /> Venue
                  </label>
                  <select
                    value={venueId}
                    onChange={(e) => setVenueId(e.target.value as VenueId)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  >
                    {VENUES.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <MapPin size={11} /> My Location
                  </label>
                  <select
                    value={currentNodeId}
                    onChange={(e) => setCurrentNodeId(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  >
                    {currentNodes.map((n) => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Users size={11} /> Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  >
                    <option value="fan">Fan</option>
                    <option value="volunteer">Volunteer</option>
                    <option value="media">Media</option>
                    <option value="staff">Staff</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Accessibility size={11} /> Accessibility
                  </label>
                  <select
                    value={accessibilityProfile}
                    onChange={(e) => setAccessibilityProfile(e.target.value as AccessibilityProfile)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  >
                    <option value="standard">Standard</option>
                    <option value="wheelchair">Wheelchair</option>
                    <option value="low_vision">Low Vision</option>
                    <option value="hearing_impaired">Hearing Impaired</option>
                    <option value="cognitive">Cognitive Support</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Languages size={11} /> Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Timer size={11} /> Mins to Kickoff
                  </label>
                  <input
                    type="number"
                    min={-120}
                    max={300}
                    value={minutesToKickoff}
                    onChange={(e) => setMinutesToKickoff(Number(e.target.value))}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Ticket size={11} /> Ticket Section (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 120B, VIP East"
                    value={ticketSection}
                    onChange={(e) => setTicketSection(e.target.value)}
                    className="w-full text-sm px-3 py-2 rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <ChevronRight size={14} className="text-accent-400" />
                <span className="text-xs font-bold text-primary-300 uppercase tracking-wider">Quick Actions</span>
              </div>
              <div className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.message)}
                    disabled={isStreaming || isWaiting}
                    className="w-full flex items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-xs font-medium text-primary-300 hover:text-white hover:bg-primary-800/60 border border-transparent hover:border-primary-700/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="text-accent-400 flex-shrink-0">{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-primary-300">Venue Crowd Status</span>
                <button
                  onClick={() => {
                    fetch('/api/crowd')
                      .then((r) => r.json())
                      .then((d) => d?.level && setCrowdLevel(d.level))
                      .catch(() => {});
                  }}
                  className="text-primary-500 hover:text-primary-300 transition-colors"
                >
                  <RefreshCw size={11} />
                </button>
              </div>
              <CrowdBadge level={crowdLevel} size="md" showIcon={true} />
              <p className="text-xs text-primary-500 mt-2">{venueLabel}</p>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-primary-800/40 bg-primary-950/60 flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/30 to-primary-700 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
                B9
              </div>
              <div>
                <p className="text-sm font-bold text-white">Beyond90 AI Assistant</p>
                <p className="text-xs text-primary-400">{venueLabel} &bull; {accessibilityProfile !== 'standard' ? accessibilityProfile.replace('_', ' ') + ' mode' : 'Standard mode'}</p>
              </div>
            </div>
            <div className="flex-1" />
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-primary-500 hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                <RefreshCw size={11} /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
            {messages.length === 0 && !isWaiting && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="text-5xl mb-4">⚽</div>
                <h3 className="text-xl font-bold text-white mb-2">Welcome to Beyond90 AI</h3>
                <p className="text-primary-300 text-sm max-w-md mb-8">
                  Your intelligent matchday companion for FIFA World Cup 2026. Ask me anything about
                  navigation, crowd status, facilities, or accessibility at {venueLabel}.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="text-left text-xs px-3 py-2.5 rounded-lg border border-primary-700/40 hover:border-accent-500/30 hover:bg-primary-800/40 text-primary-300 hover:text-white transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div className="mt-8 flex items-center gap-2 text-xs text-primary-500">
                  <span className="pulse-live" />
                  Powered by Claude AI &bull; Responds in {LANGUAGES.find((l) => l.code === language)?.label ?? 'English'}
                </div>
              </div>
            )}

            {messages.map((message, i) => {
              const isLast = i === messages.length - 1;
              const streaming = isLast && message.role === 'assistant' && isStreaming;
              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isStreaming={streaming}
                />
              );
            })}

            {isWaiting && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          <div className="flex-shrink-0 border-t border-primary-800/40 p-4 bg-primary-950/80">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about the venue, crowd, navigation, facilities..."
                  disabled={isStreaming || isWaiting}
                  rows={1}
                  className="w-full text-sm px-4 py-3 pr-12 rounded-xl resize-none min-h-[48px] max-h-32 disabled:opacity-50 overflow-y-auto"
                  style={{ lineHeight: '1.5' }}
                  onInput={(e) => {
                    const t = e.currentTarget;
                    t.style.height = 'auto';
                    t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                  }}
                />
                <div className="absolute right-3 bottom-3 text-xs text-primary-600">
                  {isStreaming || isWaiting ? '' : '↵'}
                </div>
              </div>
              <button
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isStreaming || isWaiting}
                className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-primary-900 hover:from-accent-300 hover:to-accent-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg self-end"
              >
                <Send size={18} />
              </button>
            </div>
            <p className="text-center text-xs text-primary-600 mt-2">
              Beyond90 AI &bull; {venueLabel} &bull; Powered by Claude
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
