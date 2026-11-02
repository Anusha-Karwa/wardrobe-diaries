import type { Metadata, Viewport } from "next";
import { Caveat, Nunito } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const nunito = Nunito({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const caveat = Caveat({ variable: "--font-playfair", subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Wardrobe Diaries",
  description: "Your wardrobe, kept like a diary: outfits, trends and a stylist that knows your clothes",
};

export const viewport: Viewport = {
  themeColor: "#FFFDF6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${caveat.variable}`}>
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
