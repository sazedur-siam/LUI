import type { Metadata } from "next";
import { Roboto, Roboto_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const sans = Roboto({ variable: "--font-sans", subsets: ["latin"], weight: ["400", "500", "700"] });
const mono = Roboto_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "LUI · Learn", template: "%s · LUI" },
  description: "Turn any local course folder into a clean, trackable course player.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background">
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
