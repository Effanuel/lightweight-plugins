import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WebSocketProvider } from "@/context/WebSocketContext";
import { ChartProvider } from "@/context/ChartContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lightweight plugins",
  description: "Lightweight plugins",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WebSocketProvider>
          <ChartProvider>{children}</ChartProvider>
        </WebSocketProvider>
      </body>
    </html>
  );
}
