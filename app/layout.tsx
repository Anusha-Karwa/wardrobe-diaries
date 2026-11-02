import type { Metadata, Viewport } from "next";
import { Nunito, Playfair_Display } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const nunito = Nunito({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Closet",
  description: "Your AI wardrobe stylist and trend agent",
};

export const viewport: Viewport = {
  themeColor: "#FFFAF3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${nunito.variable} ${playfair.variable}`}>
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
