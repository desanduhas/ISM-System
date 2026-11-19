import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ISM Flow — Marketing Operations",
  description: "Plan, produce, approve and close every client job in one place.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
