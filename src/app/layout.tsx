import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { SidebarNav } from "@/components/shell/sidebar-nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "AI Control Center",
    template: "%s · AI Control Center",
  },
  description:
    "Local-first control center for AI subscriptions, API usage, costs, and machine activity.",
};

// Local-first app: always render fresh data from SQLite, no static caching.
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const theme = cookieStore.get("acc-theme")?.value === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm"
        >
          Skip to main content
        </a>
        <div className="flex min-h-dvh flex-col lg:flex-row">
          <SidebarNav />
          <main
            id="main"
            className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8"
          >
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
