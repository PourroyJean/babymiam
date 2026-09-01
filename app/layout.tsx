import type { Metadata } from "next";
import localFont from "next/font/local";
import { BuildVersionBadge } from "@/components/build-version-badge";
import "./globals.css";

const fredoka = localFont({
  src: "./fonts/fredoka-v17-latin-regular.woff2",
  display: "swap",
  variable: "--font-fredoka"
});

export const metadata: Metadata = {
  title: "Grrrignote",
  description: "Suivi de la diversification alimentaire de bébé",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={fredoka.variable}>
        {children}
        <BuildVersionBadge />
      </body>
    </html>
  );
}
