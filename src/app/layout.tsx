import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import { Providers } from "@/app/providers";
import { CursorGlow } from "@/components/cursor-glow";
import "./globals.css";

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Telegraph Intelligence Terminal",
  description: "Buy, sell, and settle verified machine intelligence.",
  metadataBase: new URL("https://terminal.telegraphprotocol.com"),
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "Telegraph Intelligence Terminal",
    description: "Buy, sell, and settle verified machine intelligence.",
    url: "https://terminal.telegraphprotocol.com",
    siteName: "Telegraph Intelligence Terminal",
    images: [
      {
        url: "/telegraph-social-card.jpg",
        width: 1200,
        height: 630,
        alt: "Telegraph Protocol",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Telegraph Intelligence Terminal",
    description: "Buy, sell, and settle verified machine intelligence.",
    images: ["/telegraph-social-card.jpg"],
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
      className={`dark ${robotoMono.variable} h-dvh overflow-hidden antialiased`}
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
