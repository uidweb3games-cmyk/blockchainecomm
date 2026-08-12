'use client';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { bscTestnet } from 'wagmi/chains';
import { config } from './wagmi';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

const PRIVY_APP_ID = 'cms4ucycp01pb0cjrjrmwxdqs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  // Registers the service worker Chrome/Android need before they'll offer
  // an "Install App" prompt. Safe to skip silently if it fails - the site
  // still works completely normally either way, this only affects whether
  // the install prompt shows up.
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  return (
    <html lang="en">
      <head>
        {/* Android/Chrome - reads manifest.json for icon, name, colors, and
            enables the "Install App" prompt */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#a3e635" />

        {/* iOS Safari - ignores manifest.json entirely for "Add to Home
            Screen". Needs these specific tags instead to get a proper icon,
            app name, and to open full-screen without Safari's browser bar. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OpenSpace" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={inter.className}>
        <PrivyProvider
          appId={PRIVY_APP_ID}
          config={{
            loginMethods: ['email', 'google', 'twitter', 'passkey', 'wallet'],
            defaultChain: bscTestnet,
            supportedChains: [bscTestnet],
            embeddedWallets: {
              ethereum: {
                createOnLogin: 'users-without-wallets',
              },
            },
          }}
        >
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={config}>
              {children}
            </WagmiProvider>
          </QueryClientProvider>
        </PrivyProvider>
        <Analytics />
      </body>
    </html>
  );
}
