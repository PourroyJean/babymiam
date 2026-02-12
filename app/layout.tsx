import type { Metadata } from "next";
import "./globals.css";

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
      <body>{children}</body>
    </html>
  );
}
