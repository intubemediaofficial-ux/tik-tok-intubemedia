import type { MetadataRoute } from "next";
import { appName } from "@/lib/format";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName, short_name: appName, description: "Short videos, LIVE and trending sounds.", start_url: "/", display: "standalone",
    background_color: "#0b0a12", theme_color: "#0b0a12",
    icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }, { src: "/icon-512.png", sizes: "512x512", type: "image/png" }],
  };
}
