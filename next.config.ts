import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    KRAKEN_FEED_POLL_INTERVAL_MS: process.env.KRAKEN_FEED_POLL_INTERVAL_MS,
    KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS: process.env.KRAKEN_CATCHUP_ADVANCE_INTERVAL_MS,
    NEXT_PUBLIC_KRAKEN_MIN_INTEREST: process.env.NEXT_PUBLIC_KRAKEN_MIN_INTEREST,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  },
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
