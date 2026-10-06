import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Dev server logs every Server Function call with its arguments by default,
  // which prints plaintext passwords from loginUser/registerUser to the terminal.
  logging: {
    serverFunctions: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "30mb",
    },
    proxyClientMaxBodySize: "500mb",
  },
  serverExternalPackages: ["unzipper"],
  // Production Security Headers Hardening
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            // TODO: In the future, if you integrate external services such as Razorpay, Stripe, Google Analytics,
            // you must append their domains (e.g. https://api.razorpay.com, https://js.stripe.com) to script-src, frame-src, or connect-src.
            value: [
              "default-src 'self';",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval';",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
              "img-src 'self' data: blob: https: http:;",
              "font-src 'self' data: https://fonts.gstatic.com;",
              // connect-src allows local requests and self API calls. Add payment APIs here later if needed.
              "connect-src 'self';",
              "frame-ancestors 'none';",
              "object-src 'none';",
              "base-uri 'self';"
            ].join(" ")
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  }
};

export default nextConfig;
