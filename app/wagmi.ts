import { createConfig, http } from 'wagmi';
import { bscTestnet } from 'wagmi/chains';
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
        url: 'http://localhost:3000',
        icons: ['https://avatars.githubusercontent.com/u/37784886'],
      },
    }),
  ],
  transports: {
    [bscTestnet.id]: http('https://bsc-testnet-rpc.publicnode.com'),
  },
});