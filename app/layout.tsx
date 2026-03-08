import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "My Website",
  description: "My personal website with a Resy scraper",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Toaster position="top-center" />
        <main className="min-h-screen bg-gray-50 text-gray-800">
          <nav className="bg-white border-b shadow-sm mb-4">
            <div className="container mx-auto px-4 sm:px-8 py-3 flex space-x-6">
              <Link href="/" className="text-gray-600 hover:text-black font-medium transition-colors">Home</Link>
              <Link href="/resy" className="text-gray-600 hover:text-black font-medium transition-colors">Resy</Link>
            </div>
          </nav>
          <div className="container mx-auto p-4 sm:p-8">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}