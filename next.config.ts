import type { NextConfig } from "next";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const normalizedBasePath =
  rawBasePath && rawBasePath !== "/"
    ? `${rawBasePath.startsWith("/") ? "" : "/"}${rawBasePath.replace(/\/+$/, "")}`
    : "";

const nextConfig: NextConfig = {
  output: process.env.NEXT_OUTPUT_MODE === "standalone" ? "standalone" : "export",
  trailingSlash: true,
  ...(normalizedBasePath ? { basePath: normalizedBasePath } : {}),
  images: {
    unoptimized: true,
  },
  experimental: {
    cpus: 1,
    staticGenerationRetryCount: 3,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack: (config) => {
    for (const rule of config.module.rules) {
      if (rule && typeof rule === "object" && Array.isArray(rule.oneOf)) {
        for (const subRule of rule.oneOf) {
          if (
            subRule &&
            typeof subRule === "object" &&
            Array.isArray(subRule.use) &&
            subRule.use.some(
              (u: unknown) =>
                typeof u === "object" &&
                u !== null &&
                "loader" in u &&
                typeof (u as { loader?: string }).loader === "string" &&
                (u as { loader: string }).loader.includes("css-loader")
            )
          ) {
            subRule.use.push("@tailwindcss/turbopack");
          }
        }
      }
    }
    return config;
  },
};

export default nextConfig;
