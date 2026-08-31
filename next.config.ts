import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",

  turbopack: {
    resolveAlias: {
      canvas: path.resolve(__dirname, "./canvas-stub.js"),
    },
  },

  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Nothing served here should ever be sniffed into a different
          // content type than declared (relevant to the MinIO-proxied PDF
          // and avatar routes, which echo back a stored Content-Type).
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // No route in this app is meant to be framed by another origin.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
