/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  webpack: (config) => {
    // Support Web Workers
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: { loader: "next-worker-loader" },
    });

    return config;
  },
};

export default nextConfig;
