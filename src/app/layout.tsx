import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const rawBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const basePath =
  rawBasePath && rawBasePath !== "/"
    ? `${rawBasePath.startsWith("/") ? "" : "/"}${rawBasePath.replace(/\/+$/, "")}`
    : "";

export const metadata: Metadata = {
  title: "AgroMarket — B2B Direct Agri-Marketplace",
  description:
    "Farm-gate produce procurement for restaurants and cafes with managed morning milk-run delivery.",
  manifest: `${basePath}/manifest.webmanifest`,
};

export const viewport: Viewport = {
  themeColor: "#1B4332",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
