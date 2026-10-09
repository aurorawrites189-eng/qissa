/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep this config compatible with @cloudflare/next-on-pages:
  // - no `output: 'export'` overrides beyond what next-on-pages handles
  // - no node-only APIs at build time
  reactStrictMode: true,
};

export default nextConfig;
