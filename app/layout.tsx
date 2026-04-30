import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LTP Beregner for lastebil",
  description: "Regn ut lastens tyngdepunkt med en enkel og profesjonell kalkulator.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb">
      <body>{children}</body>
    </html>
  );
}
