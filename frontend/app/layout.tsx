import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["300", "400", "500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "NEXUS-NODE | Semantic Intelligence Engine",
  description:
    "High-frequency data engineering platform mapping unstructured news events into a live Knowledge Graph.",
  keywords: ["knowledge graph", "NLP", "NER", "sentiment analysis", "data engineering"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} ${inter.variable}`}>
      <body className="bg-nexus-bg text-nexus-text antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
