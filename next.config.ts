import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // The deploy script builds into a separate folder (NEXT_DIST_DIR=.next-build) and swaps it in
  // only when the build has finished, so the running site is never without its build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep the SQLite native module out of the webpack bundle (it can't be statically
  // bundled — must load from node_modules at runtime). Without this the webpack build
  // breaks better-sqlite3 → every DB query (and thus every page) 500s.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  // Allow larger uploads (quotation / proposal PDFs) through Server Actions.
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};

export default nextConfig;
