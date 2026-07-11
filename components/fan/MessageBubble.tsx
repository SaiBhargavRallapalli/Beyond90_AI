'use client';

import { Map, Users, AlertCircle, Zap, Compass, Wind } from 'lucide-react';
import type { ChatMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

const TOOL_CHIP_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  navigate:      { label: 'Route found',      icon: <Map size={11} />,       color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  crowd:         { label: 'Crowd checked',    icon: <Users size={11} />,     color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  facility:      { label: 'Facilities',       icon: <Compass size={11} />,   color: 'text-accent-400 bg-accent-500/10 border-accent-500/20' },
  alert:         { label: 'Alerts scanned',   icon: <AlertCircle size={11} />, color: 'text-stadium-400 bg-stadium-500/10 border-stadium-500/20' },
  sustainability:{ label: 'Sustainability',   icon: <Wind size={11} />,      color: 'text-emerald-300 bg-emerald-600/10 border-emerald-500/20' },
  ai:            { label: 'Claude AI',        icon: <Zap size={11} />,       color: 'text-primary-200 bg-primary-700/50 border-primary-600/30' },
};

function resolveChip(tool: string) {
  const key = Object.keys(TOOL_CHIP_CONFIG).find((k) => tool.toLowerCase().includes(k));
  if (key) return TOOL_CHIP_CONFIG[key];
  return { label: tool, icon: <Zap size={11} />, color: 'text-primary-300 bg-primary-700/50 border-primary-600/30' };
}

function formatTime(timestamp: string) {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${key}`} className="my-2 space-y-1">
          {listItems.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-primary-200">
              <span className="text-accent-400 mt-0.5 flex-shrink-0">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, i) => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
    } else {
      flushList(String(i));
      if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-sm font-bold text-accent-400 mt-3 mb-1">
            {line.slice(4)}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-base font-bold text-accent-300 mt-3 mb-1">
            {line.slice(3)}
          </h2>
        );
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-1" />);
      } else {
        const withBold = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-accent-300 font-semibold">$1</strong>');
        const withItalic = withBold.replace(/\*(.*?)\*/g, '<em class="text-primary-200 italic">$1</em>');
        elements.push(
          <p
            key={i}
            className="text-sm leading-relaxed text-primary-100"
            dangerouslySetInnerHTML={{ __html: withItalic }}
          />
        );
      }
    }
  });

  flushList('end');
  return <>{elements}</>;
}

export default function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const toolsUsed = message.metadata?.toolsUsed ?? [];
  const crowdAlert = message.metadata?.crowdAlert;

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 animate-slide-up">
        <div className="max-w-[78%] flex flex-col items-end gap-1">
          <div className="relative rounded-2xl rounded-tr-sm px-4 py-3 bg-primary-700/60 border border-accent-500/25 shadow-md">
            <div
              className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-accent-400 to-accent-600"
              style={{ left: '-1px' }}
            />
            <p className="text-sm text-primary-100 leading-relaxed whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
          <span className="text-xs text-primary-500 pr-1">{formatTime(message.timestamp)}</span>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-500/20 border border-accent-500/30 flex items-center justify-center text-xs font-bold text-accent-400">
          You
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-slide-up">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500/30 to-primary-700 border border-emerald-500/30 flex items-center justify-center text-xs font-bold text-emerald-400">
        B9
      </div>
      <div className="max-w-[82%] flex flex-col gap-2">
        <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 shadow-md">
          {message.content ? (
            <MarkdownContent text={message.content} />
          ) : isStreaming ? null : (
            <p className="text-sm text-primary-400 italic">No response received.</p>
          )}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-accent-400 ml-0.5 animate-pulse align-middle" />
          )}
          {crowdAlert && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-stadium-600/15 border border-stadium-500/25 flex gap-2 items-start">
              <AlertCircle size={14} className="text-stadium-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-stadium-300">{crowdAlert.message}</p>
            </div>
          )}
        </div>
        {toolsUsed.length > 0 && !isStreaming && (
          <div className="flex flex-wrap gap-1.5 pl-1">
            {toolsUsed.map((tool, i) => {
              const chip = resolveChip(tool);
              return (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${chip.color}`}
                >
                  {chip.icon}
                  {chip.label}
                </span>
              );
            })}
          </div>
        )}
        <span className="text-xs text-primary-500 pl-1">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}
