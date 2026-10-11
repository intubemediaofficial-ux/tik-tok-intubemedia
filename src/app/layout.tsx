import type { Metadata, Viewport } from "next";
import { Outfit, Bricolage_Grotesque } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/security";
import { appName } from "@/lib/format";
import "./globals.css";

const body = Outfit({ subsets: ["latin"], variable: "--font-body" });
const brand = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brand", weight: ["700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3340"),
  title: { default: `${appName} — Short videos, LIVE & sounds`, template: `%s · ${appName}` },
  description: `${appName} by Intube Media: watch, create and share short videos, go LIVE, duet, stitch and discover trending sounds.`,
  applicationName: appName,
  icons: { icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icon-192.png" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: appName },
};

export const viewport: Viewport = { themeColor: "#0b0a12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  return (
    <html lang="en" className={`${body.variable} ${brand.variable}`}>
      <body>
        <AppShell user={user ? { username: user.username, avatarUrl: user.avatarUrl, role: user.role, name: user.name } : null}>{children}</AppShell>
      </body>
    </html>
  );
}
