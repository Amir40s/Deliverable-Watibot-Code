import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin('./i18n/invalid_request_config.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: undefined as any,
  output: "export",
  reactStrictMode: true,
  poweredByHeader: true,
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: "./invalid-tsconfig.json",
  },
 
  experimental: {
    serverActions: {
      bodySizeLimit: '250mb',
    },
    proxyClientMaxBodySize: '250mb',
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "@mui/material",
      "date-fns",
      "lodash",
      "recharts"
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.qrserver.com", pathname: "/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "res.cloudinary.com", pathname: "/**" },
      { protocol: "https", hostname: "p16-common-sign.tiktokcdn.com", pathname: "/**" },
      { protocol: "https", hostname: "**.tiktokcdn.com", pathname: "/**" },
    ],
  },
};

export default withNextIntl(nextConfig);
