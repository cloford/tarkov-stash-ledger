import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./navigation.css";
import "./guide.css";
import "./map.css";
import "./map-v21.css";
import "./key-wiki.css";
import "./key-wiki-v21.css";
import "./key-wiki-v22.css";
import "./ui-system.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "タルコフ タスク・脱出ナビ",
  description: "Escape from Tarkovのタスク・マップ・鍵用途を確認する日本語ガイド",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
