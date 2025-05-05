import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WebSocketProvider } from "@/context/WebSocketContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lightweight plugins",
  description: "Lightweight plugins",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WebSocketProvider>{children}</WebSocketProvider>
      </body>
    </html>
  );
}
