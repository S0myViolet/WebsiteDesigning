import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "Dubai Lead Gen — Website Opportunity Finder",
  description:
    "Find Dubai businesses with strong Google Maps profiles but no website, analyze their reviews with AI, score the opportunity, and generate tailored draft websites.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
