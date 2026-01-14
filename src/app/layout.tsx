import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "MOMCAST - 엄마를 위한 영상 제작 플랫폼",
  description: "소중한 순간을 특별한 영상으로, MOMCAST에서 누구나 쉽게 영상을 제작해 보세요.",
  icons: {
    icon: [
      { url: "/momcast-logo.png?v=2" },
      { url: "/momcast-logo.png?v=2", rel: "shortcut icon" }
    ],
    apple: "/momcast-logo.png?v=2",
  },
};

import { Providers } from "./Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
