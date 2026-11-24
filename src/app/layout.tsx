import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MA Sorteio de Times",
  description: "Times equilibrados, placar ao vivo e o campeonato da sua pelada.",
  applicationName: "MA Sorteio de Times",
  appleWebApp: { capable: true, title: "MA Sorteio", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#1B1430",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${grotesk.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
