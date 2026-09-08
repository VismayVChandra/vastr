import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vastr — AI Personal Stylist",
    short_name: "Vastr",
    description:
      "Digitize your wardrobe and let Vastr's AI stylist tell you what to wear, every day.",
    start_url: "/home",
    display: "standalone",
    background_color: "#faf8f5",
    theme_color: "#faf8f5",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
