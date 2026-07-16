/** @type {import('next').NextConfig} */

const CSP = [
  "default-src 'self'",
  // Next.js requires unsafe-inline for its runtime script injection
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind CSS utility classes are injected as inline styles
  "style-src 'self' 'unsafe-inline'",
  // Google Fonts (Inter)
  "font-src 'self' https://fonts.gstatic.com data:",
  // Inline SVG data URIs used by Lucide icons
  "img-src 'self' data: blob:",
  // AI provider API endpoints + same-origin fetch
  [
    "connect-src 'self'",
    "https://api.groq.com",
    "https://generativelanguage.googleapis.com",
    "https://api.anthropic.com",
  ].join(' '),
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = [
  // Prevents clickjacking — no embedding in iframes
  { key: 'X-Frame-Options',          value: 'DENY' },
  // Stops browsers from MIME-sniffing away from declared content-type
  { key: 'X-Content-Type-Options',   value: 'nosniff' },
  // Controls how much referrer info is sent
  { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
  // Disable access to sensitive browser APIs we don't use
  { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Force HTTPS for 1 year, include subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Full CSP — restricts resource origins and prevents XSS
  { key: 'Content-Security-Policy',  value: CSP },
];

const nextConfig = {
  output: "standalone",
  experimental: {
    serverComponentsExternalPackages: ["@anthropic-ai/sdk"],
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
