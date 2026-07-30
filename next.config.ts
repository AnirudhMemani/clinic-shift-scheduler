import type { NextConfig } from "next";

// Validate environment variables at build/startup. Importing this here means an
// invalid or missing variable fails `next build` and `next dev` immediately,
// rather than crashing deep in a request handler at runtime.
import "./src/env";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
