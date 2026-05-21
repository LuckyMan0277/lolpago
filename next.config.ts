import type { NextConfig } from "next";

const isMobile = process.env.BUILD_TARGET === "mobile";

// Capacitor iOS WebView origin: capacitor://localhost
// Capacitor Android WebView origin: https://localhost
// 둘 다 일반 브라우저와 다른 origin이라 CORS 필요.
const corsHeaders = [
  { key: "Access-Control-Allow-Origin", value: "*" },
  { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type" },
  { key: "Access-Control-Max-Age", value: "86400" },
];

const nextConfig: NextConfig = isMobile
  ? {
      output: "export",
      trailingSlash: true,
      images: { unoptimized: true },
    }
  : {
      async headers() {
        return [
          {
            source: "/api/:path*",
            headers: corsHeaders,
          },
        ];
      },
    };

export default nextConfig;
