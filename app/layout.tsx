import type React from 'react';
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ThemeProvider } from '@/components/theme-provider';
import { WalletContextProvider } from '@/components/wallet-provider';
import { Suspense } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Violet - Find Your Match',
  description: 'Modern dating app for meaningful connections',
  generator: 'v0.app',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <Suspense fallback={null}>
          <ThemeProvider defaultTheme='dark'>
            <WalletContextProvider>{children}</WalletContextProvider>
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  );
}
