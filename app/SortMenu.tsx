'use client';

import { useDropdownCoordinator } from './Dropdown';

type SortOrder = 'newest' | 'price_low' | 'price_high';

type SortMenuProps = {
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  filterAddress: string | null;
  darkMode: boolean;
  cardBg: string;
  cardBorder: string;
  subtleText: string;
};

// Now uses the shared dropdown coordinator (instead of its own local state)
// so it properly closes alongside the other header dropdowns, and vice
// versa - restoring full mutual exclusion now that more of them are
// extracted into their own components too.
export default function SortMenu({ sortOrder, setSortOrder, filterAddress, darkMode, cardBg, cardBorder, subtleText }: SortMenuProps) {
  const { isOpen, toggle, close } = useDropdownCoordinator('sort');

  return (
    <div className="relative" onMouseLeave={close}>
      <button
        onClick={toggle}
        className={`px-3 py-1.5 rounded-full border ${cardBorder} text-xs font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} flex items-center gap-1`}
      >
        Sort: {sortOrder === 'newest' ? 'Newest' : sortOrder === 'price_low' ? 'Price: Low to High' : 'Price: High to Low'}
        <span className="text-[10px]">▾</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className={`absolute left-0 mt-2 w-48 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50`}>
            <button
              onClick={() => { setSortOrder('newest'); close(); }}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium ${sortOrder === 'newest' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
            >
              Newest
            </button>
            <button
              onClick={() => { if (filterAddress !== null) { setSortOrder('price_low'); close(); } }}
              disabled={filterAddress === null}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium ${filterAddress === null ? `${subtleText} cursor-not-allowed opacity-60` : sortOrder === 'price_low' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
            >
              Price: Low to High {filterAddress === null && <span className="block text-[10px] font-normal">Pick a currency first</span>}
            </button>
            <button
              onClick={() => { if (filterAddress !== null) { setSortOrder('price_high'); close(); } }}
              disabled={filterAddress === null}
              className={`w-full text-left px-4 py-2.5 text-sm font-medium ${filterAddress === null ? `${subtleText} cursor-not-allowed opacity-60` : sortOrder === 'price_high' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
            >
              Price: High to Low {filterAddress === null && <span className="block text-[10px] font-normal">Pick a currency first</span>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
