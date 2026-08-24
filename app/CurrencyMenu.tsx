'use client';

import { useDropdownCoordinator } from './Dropdown';

// Kept identical to the constant already in page.tsx - duplicated here
// rather than imported, to keep this component fully self-contained and
// not dependent on page.tsx's internals.
const VIEW_CURRENCIES: Record<string, { label: string; address: string | null; symbol: string }> = {
  ALL: { label: 'All Currencies', address: null, symbol: '' },
  BNB: { label: 'tBNB', address: '0x0000000000000000000000000000000000000000', symbol: 'tBNB' },
  USDC: { label: 'USDC', address: '0x64544969ed7EBf5f083679233325356EbE738930', symbol: 'USDC' },
  USDT: { label: 'USDT', address: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', symbol: 'USDT' },
};

type CurrencyMenuProps = {
  viewCurrency: string;
  setViewCurrency: (key: string) => void;
  darkMode: boolean;
  cardBg: string;
  cardBorder: string;
};

export default function CurrencyMenu({ viewCurrency, setViewCurrency, darkMode, cardBg, cardBorder }: CurrencyMenuProps) {
  const { isOpen, toggle, close } = useDropdownCoordinator('currency');

  return (
    <div className="relative" onMouseLeave={close}>
      <button onClick={toggle} title="Filter by currency" className="w-10 h-10 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-2xl">
        💱
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className={`absolute right-0 mt-2 w-44 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50`}>
            {Object.keys(VIEW_CURRENCIES).map((key) => (
              <button
                key={key}
                onClick={() => { setViewCurrency(key === 'ALL' ? 'ALL' : key); close(); }}
                className={`w-full text-left px-4 py-2.5 text-sm font-medium ${viewCurrency === key ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
              >
                {VIEW_CURRENCIES[key].label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
