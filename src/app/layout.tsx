import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { cn } from "@/lib/utils";

import { Toaster } from "@/components/ui/sonner";

import ExpenseEntryDrawer from "@/components/ExpenseEntryDrawer";
import { PullToRefresh } from "@/components/PullToRefresh";
import { ThemeProvider } from "@/components/theme-provider";

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
  themeColor: "#0e1118",
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
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className="no-scrollbar"
    >
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "bg-[radial-gradient(circle_at_top,#1b1d25,#151822_50%,#0e1118_100%)] antialiased"
        )}
      >
        <div className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(122,92,255,0.18),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-[-120px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(28,210,180,0.18),transparent_60%)] blur-3xl" />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <main>
            <PullToRefresh>
              {children}
              {/* floating action button */}
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2">
                <ExpenseEntryDrawer />
              </div>
            </PullToRefresh>
          </main>
        </ThemeProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
