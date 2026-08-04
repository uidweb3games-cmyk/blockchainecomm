import { createConfig } from '@privy-io/wagmi';
import { bscTestnet } from 'wagmi/chains';
import { http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';

export const config = createConfig({
  chains: [bscTestnet],
  connectors: [
    injected(),
    walletConnect({
      projectId: 'b421972c42fe553a01df73640b62eb21',
      metadata: {
        name: 'OpenSpace Marketplace',
        description: 'Decentralized escrow marketplace on BNB Testnet',
        url: 'https://openspace-ten.vercel.app',
        icons: ['https://avatars.githubusercontent.com/u/37784886'],
      },
    }),
  ],
  transports: {
    [bscTestnet.id]: http('https://bsc-testnet.core.chainstack.com/a151707dd68c361a25a121381560ca61'),
  },
});