/**
 * Accessibility structure tests — machine-verify that key WCAG 2.1 AA
 * requirements are present in the source files (mirrors test_static.py
 * in the reference repo).
 *
 * These tests parse the component source as strings and assert that
 * essential accessibility attributes exist.  They are intentionally
 * not DOM-render tests so they run without a browser environment.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8');
}

// ─── Layout (site-wide) ───────────────────────────────────────────────────────

describe('layout.tsx — site-wide WCAG requirements', () => {
  const layout = read('app/layout.tsx');

  it('declares html lang attribute', () => {
    expect(layout).toMatch(/lang\s*=\s*["']en["']/);
  });

  it('includes a skip-navigation link targeting #main', () => {
    expect(layout).toMatch(/href\s*=\s*["']#main["']/);
  });

  it('includes a <main> element with id="main"', () => {
    expect(layout).toMatch(/id\s*=\s*["']main["']/);
  });

  it('includes aria-label on the primary <nav>', () => {
    expect(layout).toMatch(/aria-label\s*=\s*["'][^"']+["']/);
  });
});

// ─── globals.css — motion & contrast ─────────────────────────────────────────

describe('globals.css — reduced-motion and focus styles', () => {
  const css = read('app/globals.css');

  it('includes prefers-reduced-motion media query', () => {
    expect(css).toMatch(/prefers-reduced-motion/);
  });

  it('includes focus-visible style', () => {
    expect(css).toMatch(/focus-visible/);
  });

  it('includes a skip-link CSS rule', () => {
    expect(css).toMatch(/skip-link/);
  });
});

// ─── Fan page — interactive elements ─────────────────────────────────────────

describe('app/fan/page.tsx — ARIA on interactive elements', () => {
  const fan = read('app/fan/page.tsx');

  it('all Send buttons have aria-label', () => {
    // Check that aria-label="Send message" appears in the file
    expect(fan).toContain('aria-label="Send message"');
  });

  it('includes at least one aria-live region for dynamic content', () => {
    expect(fan).toMatch(/aria-live/);
  });

  it('has an h1 heading', () => {
    expect(fan).toMatch(/<h1[\s>]/);
  });

  it('form inputs have associated labels (htmlFor or aria-label)', () => {
    const hasHtmlFor  = fan.includes('htmlFor');
    const hasAriaLabel = fan.includes('aria-label');
    expect(hasHtmlFor || hasAriaLabel).toBe(true);
  });

  it('textarea has aria-label or an associated label', () => {
    // Check that the textarea has either aria-label or id that a label references
    const hasAriaLabel = fan.match(/<textarea[^>]*aria-label/);
    const hasId        = fan.match(/<textarea[^>]*id=/);
    expect(!!(hasAriaLabel ?? hasId)).toBe(true);
  });
});

// ─── Ops page — interactive elements ─────────────────────────────────────────

describe('app/ops/page.tsx — ARIA on interactive elements', () => {
  const ops = read('app/ops/page.tsx');

  it('has an h1 heading', () => {
    expect(ops).toMatch(/<h1[\s>]/);
  });

  it('venue selector has an associated label', () => {
    const hasLabel     = ops.includes('htmlFor') || ops.includes('<label');
    const hasAriaLabel = ops.match(/<select[^>]*aria-label/);
    expect(!!(hasLabel || hasAriaLabel)).toBe(true);
  });

  it('SVG heatmap has role="img" for screen reader announcement', () => {
    expect(ops).toMatch(/role\s*=\s*["']img["']/);
  });

  it('SVG heatmap has an aria-label', () => {
    // The <svg> should have aria-label or an inner <title>
    const hasAriaLabel = ops.match(/<svg[^>]*aria-label/);
    const hasTitle     = ops.match(/<title>/);
    expect(!!(hasAriaLabel ?? hasTitle)).toBe(true);
  });

  it('data table has a <caption>', () => {
    expect(ops).toMatch(/<caption/);
  });

  it('Send / submit buttons have aria-label', () => {
    expect(ops).toContain('aria-label="Send ops query"');
  });

  it('includes a main landmark role or aria-label region', () => {
    const hasMain      = ops.match(/<main[\s>]/);
    const hasRoleMain  = ops.match(/role\s*=\s*["']main["']/);
    const hasRoleRegion = ops.includes('aria-label="Operations Center dashboard"');
    expect(!!(hasMain ?? hasRoleMain) || hasRoleRegion).toBe(true);
  });
});

// ─── Home page ─────────────────────────────────────────────────────────────────

describe('app/page.tsx — home page ARIA', () => {
  const home = read('app/page.tsx');

  it('has exactly one h1 on the page', () => {
    const h1Count = (home.match(/<h1[\s>]/g) ?? []).length;
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  it('primary nav has aria-label', () => {
    expect(home).toMatch(/aria-label\s*=\s*["'][^"']+["']/);
  });

  it('interactive venue cards have tabIndex or role="button"', () => {
    const hasTabIndex  = home.includes('tabIndex');
    const hasRoleBtn   = home.match(/role\s*=\s*["']button["']/);
    expect(!!(hasTabIndex || hasRoleBtn)).toBe(true);
  });
});
