/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  env: {
    // Arcium Network Configuration - MAINNET PRODUCTION
    NEXT_PUBLIC_ARCIUM_NETWORK: process.env.NEXT_PUBLIC_ARCIUM_NETWORK || 'mainnet',
    NEXT_PUBLIC_CLUSTER_OFFSET: '1116522165', // HARDCODED CLUSTER OFFSET
    NEXT_PUBLIC_PROGRAM_ID: process.env.NEXT_PUBLIC_PROGRAM_ID,
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle Node.js modules in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        os: false,
        path: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        url: false,
        util: false,
      };
    }

    // Handle pino and wallet adapter issues
    config.resolve.alias = {
      ...config.resolve.alias,
      'pino-pretty': false,
    };

    // Ignore specific modules that cause issues
    config.externals = config.externals || [];
    config.externals.push('pino-pretty');

    return config;
  },
  experimental: {
    esmExternals: 'loose',
  },
}

export default nextConfig