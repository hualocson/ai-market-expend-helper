import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn } from "@/lib/utils";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Expense Tracker",
  description: "AI Expense Tracker",
};

export const viewport: Viewport = {
  themeColor: "#fafafa",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(geistSans.variable, geistMono.variable, "antialiased")}
      >
        <main>{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
