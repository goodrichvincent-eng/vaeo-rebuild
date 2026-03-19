/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.trustbusinessbrokers.com',
      },
    ],
  },
};

export default nextConfig;
