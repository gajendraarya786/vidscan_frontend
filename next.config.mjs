/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output — minimal bundle for Docker/Railway/Render deploys.
  // Vercel ignores this and manages packaging automatically.
  output: "standalone",

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vidscan-backend.up.railway.app",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "vidscan.app",
        pathname: "/**",
      },
    ],
  },

  // Proxy /api/* → NEXT_PUBLIC_API_URL/* at the Next.js server level.
  // On Vercel this is supplemented by vercel.json rewrites.
  async rewrites() {
    const api = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
    if (!api) return [];
    return [{ source: "/api/:path*", destination: `${api}/:path*` }];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=self, microphone=self" },
        ],
      },
    ];
  },
};

export default nextConfig;
