import type { Metadata } from "next";
import "./globals.css";
import "./readability.css";

export const metadata: Metadata = {
  title: "Northstar | Mock Test Platform",
  description: "A focused workspace for measurable exam preparation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}