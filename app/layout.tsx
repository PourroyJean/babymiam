import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka"
});

export const metadata: Metadata = {
  title: "Babymiam",
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
