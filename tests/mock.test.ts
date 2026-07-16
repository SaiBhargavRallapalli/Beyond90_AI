import { describe, it, expect } from 'vitest';
import {
  streamAssistResponse,
  getOpsAnalysis,
} from '@/lib/ai/providers/mock';
import type { UserSession } from '@/lib/types';

const SESSION: UserSession = {
  id: 'test-session',
  role: 'fan',
  venueId: 'metlife',
  currentNodeId: 'gate_a',
  accessibilityProfile: 'standard',
  language: 'en',
  minutesToKickoff: 45,
};

// ─── streamAssistResponse ─────────────────────────────────────────────────────

describe('MockLLM — streamAssistResponse', () => {
  it('yields at least one chunk for any message', async () => {
    const chunks: string[] = [];
    for await (const chunk of streamAssistResponse(SESSION, 'Hello', [])) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('concatenated output is a non-empty string', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'Where is the restroom?', [])) {
      text += chunk;
    }
    expect(text.trim().length).toBeGreaterThan(10);
  });

  it('output contains a [METADATA] sentinel', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'Where is the restroom?', [])) {
      text += chunk;
    }
    expect(text).toContain('[METADATA]');
  });

  it('[METADATA] sentinel is valid JSON containing toolsUsed array', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'food near me', [])) {
      text += chunk;
    }
    const metaStart = text.indexOf('[METADATA]') + '[METADATA]'.length;
    const meta = JSON.parse(text.slice(metaStart));
    expect(Array.isArray(meta.toolsUsed)).toBe(true);
    expect(meta.toolsUsed.length).toBeGreaterThan(0);
  });

  it('[METADATA] includes mock: true flag', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'anything', [])) {
      text += chunk;
    }
    const metaStart = text.indexOf('[METADATA]') + '[METADATA]'.length;
    const meta = JSON.parse(text.slice(metaStart));
    expect(meta.mock).toBe(true);
  });

  it('navigation query returns directions content', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'How do I find my seat?', [])) {
      text += chunk;
    }
    const body = text.slice(0, text.indexOf('[METADATA]'));
    expect(body.toLowerCase()).toMatch(/route|direction|walk|concourse|gate/);
  });

  it('crowd query returns occupancy or congestion data', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'Is it busy at the gates?', [])) {
      text += chunk;
    }
    const body = text.slice(0, text.indexOf('[METADATA]'));
    expect(body.toLowerCase()).toMatch(/crowd|occupancy|congestion|queue/);
  });

  it('accessibility query returns step-free or ADA content', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'I need wheelchair access', [])) {
      text += chunk;
    }
    const body = text.slice(0, text.indexOf('[METADATA]'));
    expect(body.toLowerCase()).toMatch(/wheelchair|accessible|step-free|ada|elevator/);
  });

  it('transport query returns transit information', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'How do I get the train home?', [])) {
      text += chunk;
    }
    const body = text.slice(0, text.indexOf('[METADATA]'));
    expect(body.toLowerCase()).toMatch(/transit|shuttle|train|bus|transport/);
  });

  it('sustainability query returns green metrics', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'Tell me about recycling here', [])) {
      text += chunk;
    }
    const body = text.slice(0, text.indexOf('[METADATA]'));
    expect(body.toLowerCase()).toMatch(/recycl|sustainab|carbon|energy|green/);
  });

  it('unknown query falls back to default welcome response', async () => {
    let text = '';
    for await (const chunk of streamAssistResponse(SESSION, 'xyzzy random gibberish 1234', [])) {
      text += chunk;
    }
    const body = text.slice(0, text.indexOf('[METADATA]'));
    expect(body.toLowerCase()).toMatch(/beyond90|navigation|crowd|facilities|demo/i);
  });
});

// ─── getOpsAnalysis ───────────────────────────────────────────────────────────

describe('MockLLM — getOpsAnalysis', () => {
  it('returns a non-empty string for any query', async () => {
    const result = await getOpsAnalysis('MetLife Stadium', 30, 3, 'crowd analysis');
    expect(typeof result).toBe('string');
    expect(result.trim().length).toBeGreaterThan(20);
  });

  it('crowd query contains prioritised action items', async () => {
    const result = await getOpsAnalysis('MetLife Stadium', 20, 5, 'crowd density hotspot');
    expect(result.toLowerCase()).toMatch(/staff|deploy|action|crowd|gate/);
  });

  it('evacuation query contains safety steps', async () => {
    const result = await getOpsAnalysis('SoFi Stadium', 45, 2, 'evacuation emergency protocol');
    expect(result.toLowerCase()).toMatch(/evacuat|exit|emergency|pa|staff/);
  });

  it('sustainability query contains recycling or energy metrics', async () => {
    const result = await getOpsAnalysis('Mercedes-Benz Stadium', -45, 1, 'sustainability recycling waste');
    expect(result.toLowerCase()).toMatch(/recycl|energy|sustainab|waste|carbon/);
  });

  it('staff deployment query contains staffing recommendations', async () => {
    const result = await getOpsAnalysis('Levi\'s Stadium', 15, 4, 'staff deploy personnel');
    expect(result.toLowerCase()).toMatch(/staff|deploy|security|usher|medic/);
  });

  it('mentions the venue name in the response', async () => {
    const result = await getOpsAnalysis('Gillette Stadium', 60, 0, 'general status');
    expect(result).toContain('Gillette Stadium');
  });

  it('default query returns a structured response', async () => {
    const result = await getOpsAnalysis('Hard Rock Stadium', 90, 2, 'zzz unknown topic');
    expect(result.trim().length).toBeGreaterThan(20);
  });
});
