import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the Next.js dev indicator badge (the logo in the bottom-left corner).
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
