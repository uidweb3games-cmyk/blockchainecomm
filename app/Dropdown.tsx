'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

// A tiny, separate piece of shared state - JUST "which dropdown (if any) is
// currently open" - so extracted dropdown components can close each other
// (e.g. opening Notifications closes Currency) without that coordination
// needing to live back in the giant main page component. Only components
// that actually call useDropdownCoordinator re-render when this changes -
// the main page itself never touches this, so it stays out of the
// re-render path entirely.
type DropdownContextType = {
  openId: string | null;
  setOpenId: (id: string | null) => void;
};

const DropdownContext = createContext<DropdownContextType | null>(null);

export function DropdownProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <DropdownContext.Provider value={{ openId, setOpenId }}>
      {children}
    </DropdownContext.Provider>
  );
}

// Each dropdown component calls this with its own unique id (e.g.
// "currency", "notifications"). Returns whether THIS ONE is open, plus a
// toggle function that opens it (closing whichever other one was open) or
// closes it if it's already open.
export function useDropdownCoordinator(id: string) {
  const ctx = useContext(DropdownContext);
  if (!ctx) throw new Error('useDropdownCoordinator must be used inside a DropdownProvider');
  const isOpen = ctx.openId === id;
  const toggle = () => ctx.setOpenId(isOpen ? null : id);
  const close = () => { if (isOpen) ctx.setOpenId(null); };
  return { isOpen, toggle, close };
}
