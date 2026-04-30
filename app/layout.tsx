import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/navbar";
import { SelectionTranslateTooltip } from "@/components/selection-translate-tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SITE_DESCRIPTION, SITE_ICON_SRC, SITE_LOGO_SRC, SITE_NAME } from "@/lib/site-brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: SITE_LOGO_SRC, type: "image/png", sizes: "40x40" },
      { url: SITE_ICON_SRC, type: "image/png", sizes: "200x200" },
    ],
    apple: [{ url: SITE_ICON_SRC, type: "image/png", sizes: "200x200" }],
    shortcut: [SITE_LOGO_SRC],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Navbar />
          <main>{children}</main>
          <SelectionTranslateTooltip />
          <Toaster richColors closeButton position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
