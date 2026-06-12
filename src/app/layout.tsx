import type { Metadata } from "next";
import { Roboto_Mono, Inter } from "next/font/google";
import { Providers } from "@/app/providers";
import { CursorGlow } from "@/components/cursor-glow";
import "./globals.css";

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Kraken's Telegraph Dashboard",
  description: "AI-powered intelligence and settlement platform",
  icons: {
    icon: "/Kraken-Logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${robotoMono.variable} ${inter.variable} h-dvh overflow-hidden antialiased`}
      suppressHydrationWarning
    >
      <body className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <CursorGlow />
        <Providers>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
