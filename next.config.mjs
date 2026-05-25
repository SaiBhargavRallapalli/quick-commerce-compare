/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.blinkit.com' },
      { protocol: 'https', hostname: '**.grofers.com' },
      { protocol: 'https', hostname: '**.zeptonow.com' },
      { protocol: 'https', hostname: '**.zepto.com' },
      { protocol: 'https', hostname: '**.bigbasket.com' },
      { protocol: 'https', hostname: '**.swiggy.com' },
      { protocol: 'https', hostname: '**.jiomart.com' },
      { protocol: 'https', hostname: '**.dmart.in' },
      { protocol: 'https', hostname: '**.firstclub.io' },
      { protocol: 'https', hostname: 'cdn.grofers.com' },
      { protocol: 'https', hostname: 'cdn.zeptonow.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['playwright', 'playwright-core', '@sparticuz/chromium', 'node-cache'],
  },
};

export default nextConfig;
