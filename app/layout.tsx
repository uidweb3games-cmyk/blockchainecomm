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
import { useState } from 'react';

const inter = Inter({ subsets: ['latin'] });

const PRIVY_APP_ID = 'cms4ucycp01pb0cjrjrmwxdqs';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
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