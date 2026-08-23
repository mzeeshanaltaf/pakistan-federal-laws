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
};

export default nextConfig;
