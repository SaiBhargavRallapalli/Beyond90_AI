'use client';

import { MapPin } from 'lucide-react';
import type { VenueId } from '@/lib/types';

export interface VenueOption {
  id: VenueId;
  name: string;
  city: string;
  capacity: number;
  country: string;
}

export const VENUES: VenueOption[] = [
  { id: 'metlife',          name: 'MetLife Stadium',        city: 'East Rutherford, NJ', capacity: 82500, country: 'USA' },
  { id: 'sofi',             name: 'SoFi Stadium',           city: 'Inglewood, CA',       capacity: 70240, country: 'USA' },
  { id: 'attdallas',        name: 'AT&T Stadium',           city: 'Arlington, TX',       capacity: 80000, country: 'USA' },
  { id: 'levis',            name: "Levi's Stadium",         city: 'Santa Clara, CA',     capacity: 68500, country: 'USA' },
  { id: 'hardrock',         name: 'Hard Rock Stadium',      city: 'Miami Gardens, FL',   capacity: 65326, country: 'USA' },
  { id: 'mercedesbenz',     name: 'Mercedes-Benz Stadium',  city: 'Atlanta, GA',         capacity: 71000, country: 'USA' },
  { id: 'lincolnfinancial', name: 'Lincoln Financial Field', city: 'Philadelphia, PA',   capacity: 69796, country: 'USA' },
  { id: 'gillette',         name: 'Gillette Stadium',       city: 'Foxborough, MA',      capacity: 65878, country: 'USA' },
];

interface VenueSelectorProps {
  value: VenueId;
  onChange: (value: VenueId) => void;
  className?: string;
  showCapacity?: boolean;
  label?: string;
}

export default function VenueSelector({
  value,
  onChange,
  className = '',
  showCapacity = false,
  label = 'Venue',
}: VenueSelectorProps) {
  const selected = VENUES.find((v) => v.id === value);

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-primary-300 uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-500 pointer-events-none z-10"
        />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as VenueId)}
          className="w-full pl-9 pr-4 py-2.5 text-sm bg-primary-800/80 border border-primary-600/30 rounded-lg text-primary-100 appearance-none cursor-pointer focus:border-accent-500/50 focus:ring-2 focus:ring-accent-500/10 transition-all"
        >
          {VENUES.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
              {showCapacity ? ` — ${venue.capacity.toLocaleString()} cap.` : ''}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {selected && showCapacity && (
        <p className="text-xs text-primary-400 pl-1">
          {selected.city} &middot; {selected.capacity.toLocaleString()} seats
        </p>
      )}
    </div>
  );
}
