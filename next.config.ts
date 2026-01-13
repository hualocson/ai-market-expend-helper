import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["lucide-react"],
  output: "standalone",
  htmlLimitedBots: /.*/,
};

export default nextConfig;
