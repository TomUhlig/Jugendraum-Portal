/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['postgres'],
  // Schriften und Logo für die PDF-Erstellung mit ausliefern
  outputFileTracingIncludes: { '/**': ['./assets/fonts/*.ttf', './public/logo.png'] },
};
export default nextConfig;
