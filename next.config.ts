import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/live", destination: "/", permanent: false },
      {
        source: "/live/chat",
        destination: "/intelligence-terminal",
        permanent: false,
      },
      { source: "/demo", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
