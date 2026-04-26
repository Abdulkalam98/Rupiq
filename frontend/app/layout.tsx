import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rupiq — Know Your Money. Fix It Fast.",
  description: "AI personal finance assistant for India. Auto-import statements from Gmail or upload PDFs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
