/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ['three'],
  // A lockfile further up the disk made Next guess the wrong workspace root.
  outputFileTracingRoot: import.meta.dirname,
  // ~9 kB of CSS goes straight into the HTML instead of two render-blocking requests.
  experimental: { inlineCss: true },
};
export default nextConfig;
