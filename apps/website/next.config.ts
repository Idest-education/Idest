import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "skmbisxccohurzjudrkk.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s4-media1.study4.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
