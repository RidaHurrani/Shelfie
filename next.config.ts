import type { NextConfig } from "next";
import path from "path";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'http', hostname: 'books.google.com' },
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
// @ts-expect-error — @types/next-pwa bundles stale Next.js types incompatible with Next 16
})(nextConfig);
