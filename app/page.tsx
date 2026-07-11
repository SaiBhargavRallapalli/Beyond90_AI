'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Navigation2,
  Users,
  BarChart3,
  Globe,
  Leaf,
  HeartHandshake,
  ArrowRight,
  Wifi,
  MessageSquare,
  Compass,
  ChevronRight,
  Star,
} from 'lucide-react';

const VENUES = [
  { id: 'metlife',          name: 'MetLife Stadium',         city: 'East Rutherford, NJ', capacity: '82,500', matches: 8,  flag: '🇺🇸' },
  { id: 'sofi',             name: 'SoFi Stadium',            city: 'Inglewood, CA',       capacity: '70,240', matches: 6,  flag: '🇺🇸' },
  { id: 'attdallas',        name: 'AT&T Stadium',            city: 'Arlington, TX',       capacity: '80,000', matches: 7,  flag: '🇺🇸' },
  { id: 'levis',            name: "Levi's Stadium",          city: 'Santa Clara, CA',     capacity: '68,500', matches: 5,  flag: '🇺🇸' },
  { id: 'hardrock',         name: 'Hard Rock Stadium',       city: 'Miami Gardens, FL',   capacity: '65,326', matches: 6,  flag: '🇺🇸' },
  { id: 'mercedesbenz',     name: 'Mercedes-Benz Stadium',   city: 'Atlanta, GA',         capacity: '71,000', matches: 5,  flag: '🇺🇸' },
  { id: 'lincolnfinancial', name: 'Lincoln Financial Field', city: 'Philadelphia, PA',    capacity: '69,796', matches: 5,  flag: '🇺🇸' },
  { id: 'gillette',         name: 'Gillette Stadium',        city: 'Foxborough, MA',      capacity: '65,878', matches: 6,  flag: '🇺🇸' },
];

const FEATURES = [
  {
    icon: <Navigation2 size={28} />,
    emoji: '🗺️',
    title: 'Smart Navigator',
    description:
      'AI-powered wayfinding with real-time crowd-aware routing. Full accessibility support including wheelchair, elevator-only, and low-vision paths across all 8 venues.',
    color: 'from-emerald-500/20 to-emerald-600/5',
    border: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
  },
  {
    icon: <Users size={28} />,
    emoji: '👥',
    title: 'Crowd Intelligence',
    description:
      'Predictive crowd flow analytics using live sensor data. Identifies hotspots before they form and routes fans through optimal low-congestion paths.',
    color: 'from-accent-500/20 to-accent-600/5',
    border: 'border-accent-500/20',
    iconColor: 'text-accent-400',
  },
  {
    icon: <BarChart3 size={28} />,
    emoji: '📡',
    title: 'Ops Command',
    description:
      'Real-time operational decision support for stadium staff. AI-generated deployment recommendations, alert triage, and evacuation scenario planning.',
    color: 'from-primary-500/30 to-primary-600/5',
    border: 'border-primary-400/20',
    iconColor: 'text-primary-300',
  },
  {
    icon: <Globe size={28} />,
    emoji: '🌍',
    title: 'Multilingual AI',
    description:
      'Claude AI responds fluently in 10+ languages: English, Spanish, French, Portuguese, Arabic, German, Japanese, Korean, Italian, and Dutch.',
    color: 'from-blue-500/15 to-blue-600/5',
    border: 'border-blue-500/20',
    iconColor: 'text-blue-400',
  },
  {
    icon: <Leaf size={28} />,
    emoji: '🌱',
    title: 'Sustainability Tracker',
    description:
      'Live green matchday metrics: carbon footprint per fan, recycling rates, renewable energy share, water usage, and public transport uptake.',
    color: 'from-green-500/15 to-green-600/5',
    border: 'border-green-500/20',
    iconColor: 'text-green-400',
  },
  {
    icon: <HeartHandshake size={28} />,
    emoji: '🤝',
    title: 'Volunteer Hub',
    description:
      'AI-assisted volunteer coordination and briefing. Smart assignment based on skills, location, and real-time incident needs across the entire venue.',
    color: 'from-purple-500/15 to-purple-600/5',
    border: 'border-purple-500/20',
    iconColor: 'text-purple-400',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: <Wifi size={32} />,
    title: 'Connect',
    description:
      'Select your venue, enter your seat section, and set your accessibility needs. Beyond90 AI instantly syncs with live stadium data.',
    color: 'text-emerald-400',
    border: 'border-emerald-500/30',
  },
  {
    step: '02',
    icon: <MessageSquare size={32} />,
    title: 'Ask',
    description:
      'Ask anything in your language. "Where is the nearest accessible restroom?" or "How crowded is Gate C right now?" — Claude answers instantly.',
    color: 'text-accent-400',
    border: 'border-accent-500/30',
  },
  {
    step: '03',
    icon: <Compass size={32} />,
    title: 'Navigate',
    description:
      'Follow your personalized, crowd-aware route with step-by-step instructions. Arrive faster, safer, and ready for the match.',
    color: 'text-primary-300',
    border: 'border-primary-400/30',
  },
];

const STATS = [
  { target: 8,    suffix: '',   label: 'WC 2026 Venues',     duration: 1200 },
  { target: 3.4,  suffix: 'M', label: 'Expected Fans',       duration: 1800, decimal: 1 },
  { target: 48,   suffix: '',   label: 'Matches',             duration: 1400 },
  { target: 10,   suffix: '+',  label: 'Languages Supported', duration: 1000 },
];

function useCountUp(target: number, duration: number, decimal = 0, triggered: boolean) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!triggered) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current = Math.min(increment * step, target);
      setValue(parseFloat(current.toFixed(decimal)));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);
    return () => clearInterval(timer);
  }, [triggered, target, duration, decimal]);

  return value;
}

function StatCard({
  stat,
  triggered,
}: {
  stat: (typeof STATS)[0];
  triggered: boolean;
}) {
  const value = useCountUp(stat.target, stat.duration, stat.decimal ?? 0, triggered);
  const display =
    stat.decimal
      ? value.toFixed(stat.decimal)
      : Math.floor(value).toString();

  return (
    <div className="flex flex-col items-center text-center px-6 py-4 glass rounded-2xl">
      <div className="text-4xl md:text-5xl font-black text-gradient-gold tabular-nums">
        {display}
        {stat.suffix}
      </div>
      <div className="text-sm text-primary-300 font-medium mt-1">{stat.label}</div>
    </div>
  );
}

export default function HomePage() {
  const statsRef = useRef<HTMLDivElement>(null);
  const [statsTriggered, setStatsTriggered] = useState(false);
  const venueScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsTriggered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (statsRef.current) observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen gradient-hero text-primary-50">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-primary-700/40 glass-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center shadow-lg">
              <span className="text-primary-900 font-black text-sm">B9</span>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-white font-bold text-base">Beyond90</span>
              <span className="text-accent-400 font-semibold text-xs tracking-widest">AI</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link href="/fan" className="text-sm font-medium text-primary-300 hover:text-white transition-colors">
              Fan Hub
            </Link>
            <Link href="/ops" className="text-sm font-medium text-primary-300 hover:text-white transition-colors">
              Ops Center
            </Link>
            <a
              href="#features"
              className="text-sm font-medium text-primary-300 hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#venues"
              className="text-sm font-medium text-primary-300 hover:text-white transition-colors"
            >
              Venues
            </a>
          </div>

          <Link href="/fan">
            <button className="btn-primary text-sm">
              Get Started <ArrowRight size={14} className="inline ml-1" />
            </button>
          </Link>
        </div>
      </nav>

      <section className="relative pt-28 pb-20 px-4 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-10 w-96 h-96 bg-accent-500/4 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-1/3 w-64 h-64 bg-stadium-600/4 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent-500/25 bg-accent-500/8 text-accent-300 text-xs font-semibold mb-8 backdrop-blur-sm">
            <span className="pulse-live" />
            FIFA World Cup 2026 &bull; 8 Venues &bull; Powered by Claude AI
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
            <span className="text-white">Intelligence</span>
            <br />
            <span className="text-gradient-gold">Beyond The</span>
            <br />
            <span className="text-white">Final Whistle</span>
          </h1>

          <p className="text-lg md:text-xl text-primary-300 max-w-2xl mx-auto leading-relaxed mb-10">
            GenAI-powered smart stadium platform for FIFA World Cup 2026. Real-time crowd analytics,
            AI navigation, multilingual fan assistance, and operational intelligence — all in one platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/fan">
              <button className="btn-primary flex items-center gap-2 text-base px-8 py-3.5">
                ⚽ Enter Fan Hub
                <ChevronRight size={18} />
              </button>
            </Link>
            <Link href="/ops">
              <button className="btn-outline flex items-center gap-2 text-base px-8 py-3.5">
                📡 Ops Center
                <ChevronRight size={18} />
              </button>
            </Link>
          </div>

          <div
            ref={statsRef}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {STATS.map((stat) => (
              <StatCard key={stat.label} stat={stat} triggered={statsTriggered} />
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent-400 uppercase tracking-widest mb-4">
              <Star size={12} />
              Platform Capabilities
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
              Built for the World&apos;s Biggest Stage
            </h2>
            <p className="text-primary-300 max-w-xl mx-auto text-lg">
              Every feature engineered for the 3.4 million fans and 8 iconic venues of FIFA World Cup 2026.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className={`group relative p-6 rounded-2xl bg-gradient-to-br ${feature.color} border ${feature.border} card-hover`}
              >
                <div className={`mb-4 ${feature.iconColor}`}>{feature.icon}</div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">{feature.emoji}</span>
                  <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                </div>
                <p className="text-sm text-primary-300 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="venues" className="py-20 px-4 bg-primary-950/40">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent-400 uppercase tracking-widest mb-4">
              🏟️ Host Venues
            </div>
            <h2 className="text-4xl font-black text-white mb-3">8 Iconic Venues</h2>
            <p className="text-primary-300">Beyond90 AI deployed across every FIFA WC 2026 host stadium</p>
          </div>

          <div
            ref={venueScrollRef}
            className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin' }}
          >
            {VENUES.map((venue, i) => (
              <div
                key={venue.id}
                className="flex-shrink-0 w-64 snap-start glass rounded-2xl p-5 card-hover border border-primary-700/30 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-3xl">{venue.flag}</span>
                  <span className="text-xs font-semibold text-accent-400 bg-accent-500/10 border border-accent-500/20 px-2.5 py-1 rounded-full">
                    Venue {i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mb-1 leading-tight">{venue.name}</h3>
                <p className="text-xs text-primary-400 mb-4 flex items-center gap-1">
                  <span>📍</span> {venue.city}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2.5 rounded-lg bg-primary-800/50">
                    <div className="text-sm font-bold text-emerald-400">{venue.capacity}</div>
                    <div className="text-xs text-primary-400 mt-0.5">Capacity</div>
                  </div>
                  <div className="text-center p-2.5 rounded-lg bg-primary-800/50">
                    <div className="text-sm font-bold text-accent-400">{venue.matches}</div>
                    <div className="text-xs text-primary-400 mt-0.5">WC Matches</div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <span className="pulse-live" />
                  <span className="text-xs text-emerald-400 font-medium">AI Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent-400 uppercase tracking-widest mb-4">
              ⚡ How It Works
            </div>
            <h2 className="text-4xl font-black text-white mb-3">Three Steps to a Better Matchday</h2>
            <p className="text-primary-300 max-w-lg mx-auto">
              From entry to exit, Beyond90 AI is your intelligent companion throughout the entire stadium experience.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.step} className="relative text-center">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary-600 to-transparent" />
                )}
                <div
                  className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl border-2 ${step.border} glass mb-5 ${step.color}`}
                >
                  {step.icon}
                </div>
                <div className="text-xs font-bold text-primary-500 uppercase tracking-widest mb-2">
                  Step {step.step}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-primary-300 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass rounded-3xl p-10 border border-accent-500/15">
            <div className="text-5xl mb-4">⚽</div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Ready for Kickoff?
            </h2>
            <p className="text-primary-300 text-lg mb-8">
              Experience the future of stadium intelligence. Ask anything, navigate anywhere, in any language.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/fan">
                <button className="btn-primary flex items-center gap-2 text-base px-10 py-4">
                  🤖 Try Fan Hub
                  <ArrowRight size={18} />
                </button>
              </Link>
              <Link href="/ops">
                <button className="btn-outline flex items-center gap-2 text-base px-10 py-4">
                  📊 Ops Dashboard
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-primary-800/50 py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center">
                <span className="text-primary-900 font-black text-sm">B9</span>
              </div>
              <div>
                <div className="text-white font-bold">Beyond90 AI</div>
                <div className="text-primary-400 text-xs">FIFA World Cup 2026</div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-primary-400">
              <Link href="/fan" className="hover:text-white transition-colors">Fan Hub</Link>
              <Link href="/ops" className="hover:text-white transition-colors">Ops Center</Link>
            </div>

            <div className="flex flex-col items-center md:items-end gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5">
                <span className="pulse-live" />
                <span className="text-xs font-semibold text-emerald-400">Powered by Claude AI</span>
              </div>
              <p className="text-xs text-primary-500">&copy; 2026 Beyond90 AI. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
