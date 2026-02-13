/** @type {import('next').NextConfig} */
const e2eDistDir = process.env.E2E_DIST_DIR?.trim();

const nextConfig = e2eDistDir
  ? {
      distDir: e2eDistDir
    }
  : {};

export default nextConfig;
