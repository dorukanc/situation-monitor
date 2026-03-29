import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { getFlowInitScript } from "@/lib/flow";
import { getThemeInitScript } from "@/lib/theme";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SITUATION MONITOR",
  description: "Personal productivity dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background text-foreground font-mono antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {getThemeInitScript()}
        </Script>
        <Script id="flow-init" strategy="beforeInteractive">
          {getFlowInitScript()}
        </Script>
        {children}
      </body>
    </html>
  );
}
