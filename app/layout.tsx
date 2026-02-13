import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const fredoka = localFont({
  src: "./fonts/fredoka-v17-latin-regular.woff2",
  display: "swap",
  variable: "--font-fredoka"
});

export const metadata: Metadata = {
  title: "Grrrignote",
  description: "Suivi de la diversification alimentaire de bébé"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={fredoka.variable}>{children}</body>
    </html>
  );
}
