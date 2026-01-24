import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '*.localhost',
  ],
  // Note: Using API routes in app/api/proxy for backend communication
};

export default nextConfig;
