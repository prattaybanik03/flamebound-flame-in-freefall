// SI-assisted: drafted with Claude (Anthropic); reviewed by the team.
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlameBound: NASA microgravity fire-safety envelopes",
  description:
    "Turning 23 NASA microgravity combustion investigations into boundary-matched, DOI-verified fire-safety envelopes for spacecraft habitat engineers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preload" href="/fonts/barlow-latin-400-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/barlow-condensed-latin-600-normal.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <meta name="theme-color" content="#050913" />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
