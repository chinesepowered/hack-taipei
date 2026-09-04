import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "阿嬤的錢包 Grandma's Wallet",
  description: "會對詐騙集團說「不」的 AI 代理人，加上一個怎麼騙都騙不走錢的錢包。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fff3df" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
