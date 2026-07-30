'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useDisconnect, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { usePrivy, useLoginWithOAuth, useLoginWithEmail, useLoginWithPasskey, useConnectWallet, useWallets } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { parseEther, formatEther } from 'viem';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDT_ADDRESS, ERC20_ABI } from './contract';

const SHIPPING_LABELS = ['Processing', 'Shipped', 'Delivered'];
const FALLBACK_IMAGE = 'https://placehold.co/400x400/e2e8f0/94a3b8?text=No+Image';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ALL_KEY = 'ALL';
const ALL_CATEGORIES = 'All Categories';
const BRAND_NAME = 'OpenSpace';
const ONBOARDING_SEEN_KEY = 'openspace_onboarding_seen';

const CATEGORIES = ['Electronics', 'Gadget', 'Clothing', 'Shoes', 'Home & Furniture', 'Beauty & Health', 'Toys & Games', 'Other'];
const CATEGORY_ICONS: Record<string, string> = {
  'Electronics': '📱',
  'Gadget': '⌚',
  'Clothing': '👕',
  'Shoes': '👟',
  'Home & Furniture': '🛋️',
  'Beauty & Health': '💄',
  'Toys & Games': '🎮',
  'Other': '🏷️',
};

const CATEGORY_COLORS: Record<string, string> = {
  'Electronics': 'from-indigo-400 to-blue-500',
  'Gadget': 'from-cyan-400 to-sky-500',
  'Clothing': 'from-emerald-400 to-green-500',
  'Shoes': 'from-violet-400 to-purple-500',
  'Home & Furniture': 'from-amber-400 to-orange-500',
  'Beauty & Health': 'from-rose-400 to-pink-500',
  'Toys & Games': 'from-fuchsia-400 to-purple-600',
  'Other': 'from-slate-400 to-zinc-500',
};

const LIST_CURRENCIES: Record<string, { label: string; address: string; symbol: string }> = {
  BNB: { label: 'tBNB', address: ZERO_ADDRESS, symbol: 'tBNB' },
  USDC: { label: 'USDC', address: USDC_ADDRESS, symbol: 'USDC' },
  USDT: { label: 'USDT', address: USDT_ADDRESS, symbol: 'USDT' },
};

const VIEW_CURRENCIES: Record<string, { label: string; address: string | null; symbol: string }> = {
  [ALL_KEY]: { label: 'All Currencies', address: null, symbol: '' },
  BNB: { label: 'tBNB', address: ZERO_ADDRESS, symbol: 'tBNB' },
  USDC: { label: 'USDC', address: USDC_ADDRESS, symbol: 'USDC' },
  USDT: { label: 'USDT', address: USDT_ADDRESS, symbol: 'USDT' },
};

type ShippingInfo = { fullName: string; address: string; city: string; country: string; phone: string };
const emptyShipping: ShippingInfo = { fullName: '', address: '', city: '', country: '', phone: '' };
type ParsedItem = {
  id: number; name: string; imageUrl: string; category: string; price: bigint; seller: string; buyer: string;
  sold: boolean; released: boolean; cancelled: boolean; disputed: boolean; shippingStatus: number;
  delisted: boolean; paymentToken: string;
};

function currencySymbol(tokenAddress: string) {
  if (tokenAddress.toLowerCase() === ZERO_ADDRESS) return 'tBNB';
  if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) return 'USDC';
  if (tokenAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()) return 'USDT';
  return 'TOKEN';
}

const AVATAR_COLORS = ['from-lime-400 to-emerald-500', 'from-sky-400 to-blue-500', 'from-fuchsia-400 to-purple-500', 'from-amber-400 to-orange-500', 'from-rose-400 to-pink-500'];
function avatarGradient(addr: string) {
  const sum = addr.slice(2, 10).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

function MiniStatChart({ value, max, color }: { value: number; max: number; color: string }) {
  const data = [{ name: 'value', v: value }, { name: 'rest', v: Math.max(max - value, 0) }];
  return (
    <div className="w-full h-10 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <Bar dataKey="v" radius={[6, 6, 6, 6]} barSize={10}>
            <Cell fill={color} />
            <Cell fill="rgba(148,163,184,0.15)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function OpenSpaceLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 340 130" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="osGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path
        d="M 91.37 49 A 42 42 0 1 0 91.37 91"
        fill="none"
        stroke="url(#osGrad)"
        strokeWidth="13"
        strokeLinecap="round"
      />
      <text x="86" y="43" fontFamily="system-ui, sans-serif" fontSize="30" fontWeight="600" fill="url(#osGrad)">pen</text>
      <text x="40" y="100" fontFamily="system-ui, sans-serif" fontSize="58" fontWeight="900" letterSpacing="0.5" fill="url(#osGrad)">SPACE</text>
    </svg>
  );
}

export default function Ecommerce() {
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'sell' | 'analytics'>('shop');
  const [showListForm, setShowListForm] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemCategory, setItemCategory] = useState(CATEGORIES[0]);
  const [itemPrice, setItemPrice] = useState('');
  const [itemCurrency, setItemCurrency] = useState('BNB');
  const [viewCurrency, setViewCurrency] = useState(ALL_KEY);
  const [viewCategory, setViewCategory] = useState(ALL_CATEGORIES);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<number[]>([]);
  const [cartCurrency, setCartCurrency] = useState<string | null>(null);
  const [shippingModal, setShippingModal] = useState<{ mode: 'single' | 'cart'; itemId?: number } | null>(null);
  const [shippingForm, setShippingForm] = useState<ShippingInfo>(emptyShipping);
  const [pendingTokenBuy, setPendingTokenBuy] = useState<{ mode: 'single' | 'cart'; id?: number; ids?: number[]; token: string; totalDue: bigint } | null>(null);
  const [disputeCenterOpen, setDisputeCenterOpen] = useState(false);
  const [resolveCenterOpen, setResolveCenterOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [walletChoiceOpen, setWalletChoiceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<{ shopName: string; bio: string } | null>(null);
  const [sellerRegOpen, setSellerRegOpen] = useState(false);
  const [shopNameInput, setShopNameInput] = useState('');
  const [shopBioInput, setShopBioInput] = useState('');
  const [editingSellerProfile, setEditingSellerProfile] = useState(false);
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [currencyMenuOpen, setCurrencyMenuOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'code'>('input');
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [oauthErr, setOauthErr] = useState('');
  const [addressCopied, setAddressCopied] = useState(false);
  const [settingsAddressCopied, setSettingsAddressCopied] = useState(false);

  const { ready: privyReady, authenticated: privyAuthenticated, logout: privyLogout, user: privyUser, exportWallet } = usePrivy();
  const loginIdentity = privyUser?.google?.email || privyUser?.email?.address || (privyUser?.twitter?.username ? `@${privyUser.twitter.username}` : null);
  const { initOAuth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { connectWallet } = useConnectWallet();
  const { wallets: privyWallets, ready: privyWalletsReady } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address, isConnected } = useAccount();

  const embeddedWallet = privyWallets.find((w) => w.walletClientType === 'privy');
  const hasEmbeddedWallet = !!embeddedWallet;

  // Diagnostic logging: prints every stage of the login/wallet-sync process with
  // a timestamp, so a single console screenshot shows exactly where things stall.
  useEffect(() => {
    console.log(`[${new Date().toLocaleTimeString()}] privyReady=${privyReady} privyAuthenticated=${privyAuthenticated}`);
  }, [privyReady, privyAuthenticated]);

  useEffect(() => {
    console.log(`[${new Date().toLocaleTimeString()}] privyWallets.length=${privyWallets.length} privyWalletsReady=${privyWalletsReady} embeddedWallet=${embeddedWallet ? embeddedWallet.address : 'none'}`);
  }, [privyWallets, privyWalletsReady, embeddedWallet]);

  // Data-confirmed fallback: sometimes authentication succeeds but Privy's wallet
  // list gets stuck empty (seen directly in console logs) instead of loading the
  // wallet that already exists. If that happens, force exactly one clean reload
  // to re-hydrate properly — guarded so it can never loop.
  useEffect(() => {
    if (privyAuthenticated && privyWalletsReady && privyWallets.length === 0) {
      const attempts = Number(sessionStorage.getItem('openspace_wallet_reload_attempts') || '0');
      if (attempts < 3) {
        const t = setTimeout(() => {
          console.log(`Wallets stuck empty after auth — reload attempt ${attempts + 1} of 3.`);
          sessionStorage.setItem('openspace_wallet_reload_attempts', String(attempts + 1));
          window.location.reload();
        }, 3000 + attempts * 2000);
        return () => clearTimeout(t);
      } else {
        console.log('Wallet still not syncing after 3 reload attempts — giving up automatic recovery.');
      }
    }
    if (privyWallets.length > 0) {
      sessionStorage.removeItem('openspace_wallet_reload_attempts');
    }
  }, [privyAuthenticated, privyWalletsReady, privyWallets.length]);

  useEffect(() => {
    console.log(`[${new Date().toLocaleTimeString()}] wagmi isConnected=${isConnected} address=${address ?? 'none'}`);
  }, [isConnected, address]);

  // Official Privy pattern: just sync whichever wallet exists into wagmi.
  // Wallet creation itself is handled entirely by createOnLogin in layout.tsx —
  // manually calling createWallet() here was fighting with that and causing
  // "User already has an embedded wallet" errors that broke the login flow.
  useEffect(() => {
    const walletToActivate = embeddedWallet ?? privyWallets[0];
    if (walletToActivate) {
      setActiveWallet(walletToActivate).catch((e) => console.error('setActiveWallet failed:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embeddedWallet, privyWallets]);

  const handleGoogleLogin = async () => {
    setOauthErr('');
    try {
      await initOAuth({ provider: 'google' });
    } catch (e: any) {
      setOauthErr(e?.message || 'Google login failed. Please try again.');
    }
  };

  const handleTwitterLogin = async () => {
    setOauthErr('');
    try {
      await initOAuth({ provider: 'twitter' });
    } catch (e: any) {
      setOauthErr(e?.message || 'X login failed. Please try again.');
    }
  };

  const handlePasskeyLogin = async () => {
    setOauthErr('');
    try {
      await loginWithPasskey();
    } catch (e: any) {
      setOauthErr(e?.message || 'Passkey login failed. Please try again.');
    }
  };

  const resetEmailFlow = () => {
    setEmailStep('input');
    setEmailInput('');
    setCodeInput('');
    setEmailErr('');
    setEmailBusy(false);
  };

  const handleSendCode = async () => {
    if (!emailInput.trim()) return;
    setEmailBusy(true);
    setEmailErr('');
    try {
      await sendCode({ email: emailInput.trim() });
      setEmailStep('code');
    } catch (e) {
      setEmailErr('Could not send code. Check the email and try again.');
    }
    setEmailBusy(false);
  };

  const handleVerifyCode = async () => {
    if (!codeInput.trim()) return;
    setEmailBusy(true);
    setEmailErr('');
    try {
      await loginWithCode({ code: codeInput.trim() });
    } catch (e) {
      setEmailErr('Incorrect code. Please try again.');
    }
    setEmailBusy(false);
  };

  useEffect(() => {
    if (isConnected && walletChoiceOpen) {
      setWalletChoiceOpen(false);
      resetEmailFlow();
      setOauthErr('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem(ONBOARDING_SEEN_KEY);
    if (!seen) {
      setHelpModalOpen(true);
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    }
  }, []);

  const { disconnect } = useDisconnect();
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const { data: myBnbBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: myUsdcBalance } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: myUsdtBalance } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const sellerProfileKey = (addr: string) => `seller_profile_${MARKETPLACE_ADDRESS}_${addr.toLowerCase()}`;

  useEffect(() => {
    if (address) {
      const raw = localStorage.getItem(sellerProfileKey(address));
      setSellerProfile(raw ? JSON.parse(raw) : null);
    } else {
      setSellerProfile(null);
    }
  }, [address]);

  const saveSellerProfile = () => {
    if (!address || !shopNameInput.trim()) {
      alert('Please enter a shop name');
      return;
    }
    const profile = { shopName: shopNameInput.trim(), bio: shopBioInput.trim() };
    localStorage.setItem(sellerProfileKey(address), JSON.stringify(profile));
    setSellerProfile(profile);
    setSellerRegOpen(false);
    setEditingSellerProfile(false);
  };

  const openSellerReg = () => {
    setShopNameInput(sellerProfile?.shopName ?? '');
    setShopBioInput(sellerProfile?.bio ?? '');
    setSellerRegOpen(true);
  };

  const openWalletChoice = () => {
    resetEmailFlow();
    setOauthErr('');
    setWalletChoiceOpen(true);
  };

  const handleDisconnect = async () => {
    try {
      await privyLogout();
    } catch (e) {
      // ignore - we clear storage manually below regardless
    }
    disconnect();
    try {
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith('privy') ||
          key.startsWith('wagmi') ||
          key.startsWith('@appkit') ||
          key.startsWith('wc@2') ||
          key.startsWith('base-acc-sdk')
        ) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      // ignore
    }
    // A full reload after clearing storage guarantees no stale session survives —
    // this is the automated version of the manual "clear storage" fix that worked.
    window.location.href = '/';
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setAddressCopied(true);
      setTimeout(() => setAddressCopied(false), 2000);
    }
  };

  const copySettingsAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setSettingsAddressCopied(true);
      setTimeout(() => setSettingsAddressCopied(false), 2000);
    }
  };

  const { data: itemCount } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'itemCount' });
  const { data: adminAddress } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'admin' });
  const { data: feeWalletAddress } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'feeWallet' });
  const { data: sellerFeePercent } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'sellerFeePercent' });
  const { data: buyerFeePercent } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'buyerFeePercent' });

  const count = itemCount ? Number(itemCount) : 0;
  const buyerFeePct = buyerFeePercent ? Number(buyerFeePercent) : 0;

  const itemContracts = Array.from({ length: count }, (_, i) => ({
    address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getItem' as const, args: [BigInt(i + 1)] as const,
  }));
  const statusContracts = Array.from({ length: count }, (_, i) => ({
    address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getItemStatus' as const, args: [BigInt(i + 1)] as const,
  }));
  const categoryContracts = Array.from({ length: count }, (_, i) => ({
    address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getItemCategory' as const, args: [BigInt(i + 1)] as const,
  }));

  const { data: itemsData } = useReadContracts({ contracts: itemContracts, query: { enabled: count > 0 } });
  const { data: statusData } = useReadContracts({ contracts: statusContracts, query: { enabled: count > 0 } });
  const { data: categoryData } = useReadContracts({ contracts: categoryContracts, query: { enabled: count > 0 } });

  const isAdmin = address && adminAddress && address.toLowerCase() === (adminAddress as string).toLowerCase();

  const { data: feeWalletBnbBalance } = useBalance({
    address: feeWalletAddress as `0x${string}` | undefined,
    query: { enabled: !!feeWalletAddress },
  });
  const { data: feeWalletUsdcBalance } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: feeWalletAddress ? [feeWalletAddress as `0x${string}`] : undefined,
    query: { enabled: !!feeWalletAddress },
  });
  const { data: feeWalletUsdtBalance } = useReadContract({
    address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf',
    args: feeWalletAddress ? [feeWalletAddress as `0x${string}`] : undefined,
    query: { enabled: !!feeWalletAddress },
  });

  const call = (functionName: string, args: any[], value?: bigint) => {
    writeContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: functionName as any, args: args as any, ...(value ? { value } : {}) });
  };

  const withBuyerFee = (price: bigint): bigint => {
    const fee = (price * BigInt(buyerFeePct)) / BigInt(100);
    return price + fee;
  };

  const allItems: ParsedItem[] = (() => {
    if (!itemsData || !statusData || !categoryData) return [];
    return itemsData
      .map((result, index) => {
        const id = index + 1;
        const statusResult = statusData[index];
        const categoryResult = categoryData[index];
        if (result.status !== 'success' || !result.result) return null;
        if (statusResult.status !== 'success' || !statusResult.result) return null;

        const [name, imageUrl, price, seller, buyer, sold, released] = result.result as [string, string, bigint, string, string, boolean, boolean];
        const [cancelled, disputed, purchaseTime, shippingStatus, delisted, paymentToken] = statusResult.result as [boolean, boolean, bigint, number, boolean, string];
        const category = categoryResult.status === 'success' && categoryResult.result ? (categoryResult.result as string) : '';

        return { id, name, imageUrl, category, price, seller, buyer, sold, released, cancelled, disputed, shippingStatus, delisted, paymentToken };
      })
      .filter((x): x is ParsedItem => x !== null);
  })();

  const handleListItem = () => {
    if (!itemName.trim() || !itemPrice || Number(itemPrice) <= 0) {
      alert('Please enter a valid name and price');
      return;
    }
    const priceInWei = parseEther(itemPrice);
    const tokenAddress = LIST_CURRENCIES[itemCurrency].address;
    call('listItem', [itemName.trim(), itemImage.trim(), itemCategory, priceInWei, tokenAddress]);
    setItemName(''); setItemImage(''); setItemPrice(''); setItemCurrency('BNB'); setItemCategory(CATEGORIES[0]);
    setShowListForm(false);
  };

  const toggleCart = (id: number, tokenAddress: string) => {
    setCart((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (next.length === 0) setCartCurrency(null);
        return next;
      }
      if (cartCurrency && cartCurrency.toLowerCase() !== tokenAddress.toLowerCase()) {
        alert(`Your cart is currently in ${currencySymbol(cartCurrency)}. Clear it first to add items in a different currency.`);
        return prev;
      }
      setCartCurrency(tokenAddress);
      return [...prev, id];
    });
  };

  const getItemPrice = (id: number): bigint => allItems.find((i) => i.id === id)?.price ?? BigInt(0);
  const cartSubtotal = cart.reduce((sum, id) => sum + getItemPrice(id), BigInt(0));
  const cartTotal = withBuyerFee(cartSubtotal);

  const saveShippingInfo = (itemIds: number[], info: ShippingInfo) => {
    if (!address) return;
    itemIds.forEach((id) => {
      localStorage.setItem(`shipping_${MARKETPLACE_ADDRESS}_${id}_${address.toLowerCase()}`, JSON.stringify(info));
    });
  };

  const getShippingInfo = (itemId: number, buyerAddress: string): ShippingInfo | null => {
    const raw = localStorage.getItem(`shipping_${MARKETPLACE_ADDRESS}_${itemId}_${buyerAddress.toLowerCase()}`);
    return raw ? JSON.parse(raw) : null;
  };

  const openShippingModal = (mode: 'single' | 'cart', itemId?: number) => {
    setShippingForm(emptyShipping);
    setShippingModal({ mode, itemId });
  };

  const proceedToSingleBuy = (id: number, price: bigint, token: string) => {
    const totalDue = withBuyerFee(price);
    if (token.toLowerCase() === ZERO_ADDRESS) {
      call('buyItem', [BigInt(id)], totalDue);
    } else {
      setPendingTokenBuy({ mode: 'single', id, token, totalDue });
      writeContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [MARKETPLACE_ADDRESS, totalDue] });
    }
  };

  const proceedToCartCheckout = (ids: number[], subtotal: bigint, token: string) => {
    const totalDue = withBuyerFee(subtotal);
    if (token.toLowerCase() === ZERO_ADDRESS) {
      call('buyMultiple', [ids.map((id) => BigInt(id)), token], totalDue);
    } else {
      setPendingTokenBuy({ mode: 'cart', ids, token, totalDue });
      writeContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [MARKETPLACE_ADDRESS, totalDue] });
    }
  };

  useEffect(() => {
    if (txConfirmed && pendingTokenBuy) {
      if (pendingTokenBuy.mode === 'single' && pendingTokenBuy.id) {
        call('buyItem', [BigInt(pendingTokenBuy.id)]);
      } else if (pendingTokenBuy.mode === 'cart' && pendingTokenBuy.ids) {
        call('buyMultiple', [pendingTokenBuy.ids.map((id) => BigInt(id)), pendingTokenBuy.token]);
      }
      setPendingTokenBuy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed]);

  const confirmShippingAndBuy = () => {
    if (!shippingForm.fullName.trim() || !shippingForm.address.trim()) {
      alert('Please fill in at least your name and address');
      return;
    }

    if (shippingModal?.mode === 'single' && shippingModal.itemId) {
      const id = shippingModal.itemId;
      const item = allItems.find((i) => i.id === id);
      if (item) {
        saveShippingInfo([id], shippingForm);
        proceedToSingleBuy(id, item.price, item.paymentToken);
      }
    } else if (shippingModal?.mode === 'cart' && cartCurrency) {
      saveShippingInfo(cart, shippingForm);
      proceedToCartCheckout(cart, cartSubtotal, cartCurrency);
      setCart([]);
      setCartCurrency(null);
    }

    setShippingModal(null);
  };

  if (!mounted) return null;

  const bg = darkMode ? 'bg-zinc-950' : 'bg-white';
  const text = darkMode ? 'text-white' : 'text-zinc-900';
  const cardBg = darkMode ? 'bg-zinc-900' : 'bg-white';
  const cardBorder = darkMode ? 'border-white/10' : 'border-zinc-200';
  const subtleText = darkMode ? 'text-zinc-400' : 'text-zinc-500';
  const headerBg = darkMode ? 'bg-zinc-950/80' : 'bg-white/80';
  const inputBg = darkMode ? 'bg-white/5' : 'bg-zinc-50';

  const filterAddress = viewCurrency === ALL_KEY ? null : VIEW_CURRENCIES[viewCurrency].address;
  const shopItems = allItems.filter((item) => {
    if (item.delisted && !item.sold) return false;
    if (item.sold) return false;
    if (filterAddress !== null && item.paymentToken.toLowerCase() !== filterAddress.toLowerCase()) return false;
    if (viewCategory !== ALL_CATEGORIES && item.category !== viewCategory) return false;
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  });

  const adItems = allItems.filter((item) => !item.sold && !(item.delisted && !item.sold));
  const adStrip = adItems.length > 0 ? [...adItems, ...adItems] : [];

  const myListings = isConnected
    ? allItems.filter((item) => item.seller.toLowerCase() === address?.toLowerCase() && !(item.delisted && !item.sold))
    : [];

  const myPurchases = isConnected
    ? allItems.filter((item) => item.sold && item.buyer.toLowerCase() === address?.toLowerCase())
    : [];

  const disputeEligible = isConnected
    ? allItems.filter((item) =>
        item.sold && !item.released && !item.cancelled && !item.disputed &&
        (item.buyer.toLowerCase() === address?.toLowerCase() || item.seller.toLowerCase() === address?.toLowerCase())
      )
    : [];

  const disputedItems = allItems.filter((item) => item.disputed && !item.released);

  const totalListed = allItems.length;
  const totalSold = allItems.filter((i) => i.sold).length;
  const totalReleased = allItems.filter((i) => i.released).length;
  const totalCancelled = allItems.filter((i) => i.cancelled).length;
  const totalActiveDisputes = disputedItems.length;
  const totalDelisted = allItems.filter((i) => i.delisted && !i.sold).length;
  const chartMax = Math.max(totalListed, 1);

  const analyticsStats = [
    { label: 'Total Items Listed', value: totalListed, color: '#a3e635' },
    { label: 'Total Sold', value: totalSold, color: '#38bdf8' },
    { label: 'Funds Released', value: totalReleased, color: '#34d399' },
    { label: 'Cancelled / Refunded', value: totalCancelled, color: '#fbbf24' },
    { label: 'Active Disputes', value: totalActiveDisputes, color: '#f87171' },
    { label: 'Delisted (Unsold)', value: totalDelisted, color: '#a78bfa' },
  ];

  const checkoutSummary = (() => {
    if (!shippingModal) return null;
    if (shippingModal.mode === 'single' && shippingModal.itemId) {
      const item = allItems.find((i) => i.id === shippingModal.itemId);
      if (!item) return null;
      const total = withBuyerFee(item.price);
      const fee = total - item.price;
      return { subtotal: item.price, fee, total, symbol: currencySymbol(item.paymentToken) };
    }
    if (shippingModal.mode === 'cart' && cartCurrency) {
      const fee = cartTotal - cartSubtotal;
      return { subtotal: cartSubtotal, fee, total: cartTotal, symbol: currencySymbol(cartCurrency) };
    }
    return null;
  })();

  const renderStatusOrActions = (item: ParsedItem, context: 'shop' | 'sell') => {
    const { id, buyer, seller, released, cancelled, disputed } = item;
    const isBuyer = isConnected && address?.toLowerCase() === buyer?.toLowerCase();
    const isSeller = isConnected && address?.toLowerCase() === seller?.toLowerCase();

    if (released) {
      return <div className={`w-full py-2.5 text-center ${darkMode ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-500'} rounded-2xl font-medium border ${cardBorder}`}>Sold</div>;
    }
    if (cancelled) {
      return <div className={`w-full py-2.5 text-center ${darkMode ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-500'} rounded-2xl font-medium border ${cardBorder}`}>Out of Stock</div>;
    }
    if (disputed) {
      return <div className="w-full py-2 text-center bg-amber-400/20 text-amber-600 rounded-2xl font-medium border border-amber-400/40 text-sm">⚠ Under Dispute</div>;
    }

    if (context === 'shop' && isBuyer) {
      return (
        <button onClick={() => call('releaseFunds', [BigInt(id)])} disabled={isPending} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
          Release Funds to Seller
        </button>
      );
    }
    if (context === 'sell' && isSeller) {
      return (
        <button onClick={() => call('cancelAndRefund', [BigInt(id)])} disabled={isPending} className={`w-full py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
          Cancel &amp; Refund Buyer
        </button>
      );
    }
    return <div className={`w-full py-2.5 text-center ${subtleText} text-sm`}>Awaiting buyer confirmation</div>;
  };

  const renderShopThumb = (item: ParsedItem) => {
    const displayImage = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : FALLBACK_IMAGE;
    return (
      <button
        key={item.id}
        onClick={() => setQuickViewId(item.id)}
        className={`group text-left ${cardBg} rounded-2xl overflow-hidden border ${cardBorder} hover:border-lime-400/60 transition-all duration-300`}
      >
        <div className={`w-full aspect-square ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} overflow-hidden relative`}>
          <img src={displayImage} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
          {cart.includes(item.id) && (
            <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-sky-400 text-zinc-900 flex items-center justify-center text-xs font-bold">✓</span>
          )}
        </div>
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium truncate">{item.name}</p>
        </div>
      </button>
    );
  };

  const renderItemCard = (item: ParsedItem, context: 'shop' | 'sell') => {
    const { id, name, imageUrl, category, price, seller, buyer, sold, released, cancelled, shippingStatus, paymentToken, disputed } = item;
    const isSeller = isConnected && address?.toLowerCase() === seller?.toLowerCase();
    const inCart = cart.includes(id);
    const displayImage = imageUrl && imageUrl.trim() !== '' ? imageUrl : FALLBACK_IMAGE;
    const shipInfo = sold && context === 'sell' ? getShippingInfo(id, buyer) : null;
    const symbol = currencySymbol(paymentToken);

    return (
      <div key={id} className={`group relative ${cardBg} rounded-3xl overflow-hidden border ${inCart ? 'border-sky-400' : cardBorder} hover:border-lime-400/60 transition-all duration-300 hover:shadow-[0_0_25px_rgba(163,230,53,0.15)]`}>
        <div className={`w-full aspect-[4/3] sm:aspect-square ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} overflow-hidden relative`}>
          <img src={displayImage} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
          {category && (
            <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold ${darkMode ? 'bg-zinc-950/80 text-white' : 'bg-white/90 text-zinc-900'} backdrop-blur-sm`}>
              {category}
            </span>
          )}
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-1.5 mb-2 sm:mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
            <span className="text-[11px] uppercase tracking-wider text-lime-600 font-semibold">Verified on-chain</span>
          </div>
          <h3 className="font-semibold text-lg sm:text-xl mb-2">{name}</h3>
          <p className={`text-xs ${subtleText} font-mono mb-3 sm:mb-4`}>{sold ? `Buyer: ${buyer.slice(0, 6)}...${buyer.slice(-4)}` : 'Not sold yet'}</p>

          <span className="text-xl sm:text-2xl font-mono block mb-3 sm:mb-4 bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
            {(Number(price) / 1e18).toString()} {symbol}
          </span>

          {shipInfo && (
            <div className={`mb-4 p-3 rounded-xl text-xs ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder}`}>
              <p className={`${subtleText} uppercase tracking-wide text-[10px] mb-1 font-semibold`}>Ship to</p>
              <p className="font-medium">{shipInfo.fullName}</p>
              <p className={subtleText}>{shipInfo.address}, {shipInfo.city}, {shipInfo.country}</p>
              {shipInfo.phone && <p className={subtleText}>{shipInfo.phone}</p>}
            </div>
          )}

          {sold && !cancelled && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                {SHIPPING_LABELS.map((label, i) => (<span key={label} className={`text-[10px] font-semibold uppercase ${i <= shippingStatus ? 'text-sky-500' : subtleText}`}>{label}</span>))}
              </div>
              <div className={`h-1.5 rounded-full ${darkMode ? 'bg-white/10' : 'bg-zinc-100'} overflow-hidden`}>
                <div className="h-full bg-gradient-to-r from-sky-400 to-lime-400 transition-all duration-500" style={{ width: `${(shippingStatus / 2) * 100}%` }} />
              </div>
              {context === 'sell' && isSeller && shippingStatus < 2 && !released && !disputed && (
                <button onClick={() => call('updateShippingStatus', [BigInt(id), shippingStatus + 1])} className="mt-2 text-xs text-sky-500 hover:text-sky-600 font-medium">
                  Mark as {SHIPPING_LABELS[shippingStatus + 1]} →
                </button>
              )}
            </div>
          )}

          {context === 'sell' && !sold ? (
            <button onClick={() => call('delistItem', [BigInt(id)])} disabled={isPending} className="w-full py-2 text-red-500 hover:text-red-600 text-xs font-medium transition-colors border border-red-500/30 rounded-xl">
              Remove Listing
            </button>
          ) : (
            renderStatusOrActions(item, context)
          )}
        </div>
      </div>
    );
  };

  const quickViewItem = quickViewId ? allItems.find((i) => i.id === quickViewId) ?? null : null;

  return (
    <div className={`min-h-screen ${bg} ${text} transition-colors duration-300 pb-12 flex flex-col overflow-x-hidden`}>
      <header className={`border-b ${cardBorder} sticky top-0 ${headerBg} backdrop-blur-xl z-50`}>
        {privyAuthenticated && !isConnected && (
          <div className="bg-sky-500 text-white text-xs font-medium py-2 px-4 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            Finishing sign-in, setting up your wallet...
          </div>
        )}
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
          <OpenSpaceLogo className="h-12 sm:h-16 w-auto shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button onClick={() => setCurrencyMenuOpen((v) => !v)} title="Filter by currency" className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-sky-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-lg shadow-md shadow-lime-400/30">
                💱
              </button>
              {currencyMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCurrencyMenuOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-44 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50`}>
                    {Object.keys(VIEW_CURRENCIES).map((key) => (
                      <button
                        key={key}
                        onClick={() => { setViewCurrency(key); setCurrencyMenuOpen(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium ${viewCurrency === key ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
                      >
                        {VIEW_CURRENCIES[key].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setCartOpen(true)} className="relative w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-lg shadow-md shadow-sky-400/30">
              🛍️
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{cart.length}</span>
              )}
            </button>

            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-lg shadow-md shadow-purple-500/30">
                ☰
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-64 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50 max-h-[75vh] overflow-y-auto`}>
                    <div className="p-2">
                      <div className="space-y-1">
                        <button onClick={() => { setActiveTab('shop'); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'shop' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>
                          🛍 Buy
                        </button>
                        <button onClick={() => { setActiveTab('sell'); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'sell' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>
                          🏪 Become a Seller / Merchant
                        </button>
                        {isAdmin && (
                          <button onClick={() => { setActiveTab('analytics'); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'analytics' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>
                            📊 Analytics
                          </button>
                        )}
                      </div>

                      <div className={`border-t ${cardBorder} mt-2 pt-2 space-y-1`}>
                        <button onClick={() => { setDarkMode(!darkMode); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                          {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                        </button>
                        <button onClick={() => { setHelpModalOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                          ❓ How to Test
                        </button>
                        {isConnected && disputeEligible.length > 0 && (
                          <button onClick={() => { setDisputeCenterOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-500 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                            ⚠ Open Dispute
                          </button>
                        )}
                        {isAdmin && disputedItems.length > 0 && (
                          <button onClick={() => { setResolveCenterOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-amber-600 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                            Resolve Disputes ({disputedItems.length})
                          </button>
                        )}
                      </div>

                      <div className={`border-t ${cardBorder} mt-2 pt-2`}>
                        {isConnected ? (
                          <div className="space-y-1.5">
                            {isAdmin && <span className="inline-block px-2 py-1 bg-amber-400/20 text-amber-600 border border-amber-400/40 rounded-lg text-[11px] font-semibold mb-1">ADMIN</span>}
                            <button
                              onClick={copyAddress}
                              className={`w-full px-3 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} border ${cardBorder} rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition-colors`}
                            >
                              {addressCopied ? (
                                <span>✓ Copied!</span>
                              ) : (
                                <>
                                  <span>{`${address?.slice(0, 6)}...${address?.slice(-4)}`}</span>
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                  </svg>
                                </>
                              )}
                            </button>
                            <div className={`px-3 py-2.5 rounded-xl ${darkMode ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02]' : 'bg-gradient-to-br from-zinc-50 to-white'} border ${cardBorder} space-y-1.5`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">B</span>
                                  <span className={`text-[11px] font-medium ${subtleText}`}>tBNB</span>
                                </div>
                                <span className="text-xs font-mono font-semibold tabular-nums">{myBnbBalance ? Number(formatEther(myBnbBalance.value)).toFixed(4) : '...'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">U</span>
                                  <span className={`text-[11px] font-medium ${subtleText}`}>USDC</span>
                                </div>
                                <span className="text-xs font-mono font-semibold tabular-nums">{myUsdcBalance !== undefined ? (Number(myUsdcBalance) / 1e18).toFixed(2) : '...'}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">U</span>
                                  <span className={`text-[11px] font-medium ${subtleText}`}>USDT</span>
                                </div>
                                <span className="text-xs font-mono font-semibold tabular-nums">{myUsdtBalance !== undefined ? (Number(myUsdtBalance) / 1e18).toFixed(2) : '...'}</span>
                              </div>
                            </div>
                            {loginIdentity && (
                              <div className={`px-3 pb-1 text-center text-[11px] ${subtleText} truncate`}>
                                {loginIdentity}
                              </div>
                            )}
                            <button onClick={() => { setPurchasesOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                              📦 My Purchases {myPurchases.filter((i) => !i.released && !i.cancelled).length > 0 ? `(${myPurchases.filter((i) => !i.released && !i.cancelled).length})` : ''}
                            </button>
                            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                              ⚙️ Wallet Settings
                            </button>
                            <button onClick={handleDisconnect} className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">Disconnect</button>
                          </div>
                        ) : (
                          <button onClick={() => { setMenuOpen(false); openWalletChoice(); }} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">
                            Login
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {activeTab === 'shop' && (
          <div className={`border-t ${cardBorder} px-4 sm:px-8 py-2.5`}>
            <div className={`max-w-6xl mx-auto flex items-center ${inputBg} border ${cardBorder} rounded-full overflow-hidden`}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="flex-1 min-w-0 bg-transparent px-4 py-2.5 outline-none text-sm"
              />
              <div className="w-8 h-8 mr-1 rounded-full bg-gradient-to-r from-lime-400 to-sky-400 flex items-center justify-center text-zinc-900 shrink-0">
                🔍
              </div>
            </div>
          </div>
        )}

        {activeTab === 'shop' && adStrip.length > 0 && (
          <div className={`border-t ${cardBorder} py-3 overflow-hidden`}>
            <div className="overflow-hidden">
              <div className="flex gap-3 w-max animate-marquee px-4 sm:px-8">
                {adStrip.map((item, i) => {
                  const displayImage = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : FALLBACK_IMAGE;
                  return (
                    <button
                      key={`${item.id}-${i}`}
                      onClick={() => setQuickViewId(item.id)}
                      className={`flex items-center gap-3 ${cardBg} border ${cardBorder} rounded-2xl pr-4 py-1.5 shrink-0 hover:border-lime-400/60 transition-colors`}
                    >
                      <img src={displayImage} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                      <div className="text-left">
                        <p className="text-sm font-medium truncate max-w-[140px]">{item.name}</p>
                        <p className="text-xs font-mono text-lime-500">{(Number(item.price) / 1e18).toString()} {currencySymbol(item.paymentToken)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex-1 w-full">
        {activeTab === 'shop' ? (
          <>
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-5xl font-black tracking-tighter">
                The Decentralised<br />
                <span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">OpenSpace Market</span>
              </h2>
            </div>

            <div className="flex gap-4 sm:gap-6">
              <div className="flex flex-col items-center gap-4 shrink-0 w-16 sm:w-20">
                <button onClick={() => setViewCategory(ALL_CATEGORIES)} className="flex flex-col items-center gap-1.5">
                  <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl ${viewCategory === ALL_CATEGORIES ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder}`}`}>
                    🗂️
                  </div>
                  <span className={`text-xs font-medium ${viewCategory === ALL_CATEGORIES ? text : subtleText}`}>All</span>
                </button>
                {CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setViewCategory(c)} className="flex flex-col items-center gap-1.5">
                    <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl ${viewCategory === c ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder}`}`}>
                      {CATEGORY_ICONS[c]}
                    </div>
                    <span className={`text-xs font-medium text-center leading-tight ${viewCategory === c ? text : subtleText}`}>{c}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 min-w-0">
                {count === 0 ? (
                  <p className={subtleText}>No items listed yet.</p>
                ) : shopItems.length === 0 ? (
                  <p className={subtleText}>No items found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                    {shopItems.map((item) => renderShopThumb(item))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : activeTab === 'sell' ? (
          <>
            <div className="mb-8 sm:mb-10 flex items-start justify-between gap-4 sm:gap-6 flex-wrap">
              <div>
                <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-3">
                  Seller<br />
                  <span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Dashboard.</span>
                </h2>
                <p className={`${subtleText} text-base sm:text-lg`}>Manage your listings, shipments, and sales.</p>
                {isConnected && sellerProfile && (
                  <button onClick={openSellerReg} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-sky-500 hover:text-sky-600">
                    🏪 {sellerProfile.shopName} <span className={`text-xs ${subtleText} font-normal`}>(edit)</span>
                  </button>
                )}
              </div>
              {isConnected && sellerProfile && (
                <button onClick={() => setShowListForm(!showListForm)} className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                  {showListForm ? 'Cancel' : '+ List an Item'}
                </button>
              )}
            </div>

            {!isConnected ? (
              <div className={`${cardBg} rounded-3xl p-8 border ${cardBorder} text-center max-w-md`}>
                <p className={`${subtleText} mb-4`}>Connect your wallet to start selling.</p>
                <button onClick={openWalletChoice} className="px-6 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity">
                  Connect Wallet
                </button>
              </div>
            ) : !sellerProfile ? (
              <div className={`${cardBg} rounded-3xl p-8 border ${cardBorder} max-w-md`}>
                <h3 className="font-semibold text-lg mb-1">Set up your shop</h3>
                <p className={`text-sm ${subtleText} mb-5`}>Just a shop name and a short bio — this only takes a moment, and you only do it once.</p>
                <div className="space-y-3 mb-5">
                  <div>
                    <label className={`text-xs ${subtleText} block mb-1`}>Shop Name</label>
                    <input type="text" value={shopNameInput} onChange={(e) => setShopNameInput(e.target.value)} placeholder="e.g. Kemi's Closet" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                  </div>
                  <div>
                    <label className={`text-xs ${subtleText} block mb-1`}>Short Bio (optional)</label>
                    <textarea value={shopBioInput} onChange={(e) => setShopBioInput(e.target.value)} placeholder="What do you sell? What makes your shop worth checking out?" rows={3} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors resize-none`} />
                  </div>
                </div>
                <button onClick={saveSellerProfile} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">
                  Create My Shop
                </button>
              </div>
            ) : (
              <>
                {showListForm && (
                  <div className={`mb-10 ${cardBg} rounded-3xl p-6 border ${cardBorder} max-w-md`}>
                    <h3 className="font-semibold text-lg mb-4">List a New Item</h3>
                    <div className="space-y-3">
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Item Name</label>
                        <input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Vintage Camera" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Image URL</label>
                        <input type="text" value={itemImage} onChange={(e) => setItemImage(e.target.value)} placeholder="https://example.com/photo.jpg" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                        <p className={`text-[11px] ${subtleText} mt-1`}>Leave blank to use a placeholder image</p>
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Category</label>
                        <select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}>
                          {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Currency</label>
                        <select value={itemCurrency} onChange={(e) => setItemCurrency(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}>
                          {Object.keys(LIST_CURRENCIES).map((key) => (<option key={key} value={key}>{LIST_CURRENCIES[key].label}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Price (in {LIST_CURRENCIES[itemCurrency].symbol})</label>
                        <input type="number" step="0.0001" min="0" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="e.g. 0.01" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                      </div>
                      <button onClick={handleListItem} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 active:scale-[0.985] transition-all disabled:opacity-50">
                        {isPending ? 'Confirm in wallet...' : 'List Item'}
                      </button>
                    </div>
                  </div>
                )}

                {myListings.length === 0 ? (
                  <p className={subtleText}>You haven't listed anything yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {myListings.map((item) => renderItemCard(item, 'sell'))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="mb-10">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-3">
                Platform<br />
                <span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Analytics.</span>
              </h2>
              <p className={`${subtleText} text-base sm:text-lg`}>Live stats pulled directly from the smart contract.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {analyticsStats.map((stat) => (
                <div key={stat.label} className={`${cardBg} rounded-3xl p-6 border ${cardBorder}`}>
                  <p className={`text-xs ${subtleText} uppercase tracking-wide mb-2`}>{stat.label}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <MiniStatChart value={stat.value} max={chartMax} color={stat.color} />
                </div>
              ))}
            </div>

            <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} max-w-md`}>
              <h3 className="font-semibold text-lg mb-1">Platform Fee Wallet</h3>
              <p className={`text-xs ${subtleText} mb-4 font-mono`}>
                {feeWalletAddress ? `${(feeWalletAddress as string).slice(0, 6)}...${(feeWalletAddress as string).slice(-4)}` : 'Loading...'} — {buyerFeePercent ? Number(buyerFeePercent) : '—'}% buyer fee + {sellerFeePercent ? Number(sellerFeePercent) : '—'}% seller fee
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${subtleText}`}>tBNB collected</span>
                  <span className="font-mono font-semibold">{feeWalletBnbBalance?.value ? formatEther(feeWalletBnbBalance.value).slice(0, 8) : '0'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${subtleText}`}>USDC collected</span>
                  <span className="font-mono font-semibold">{feeWalletUsdcBalance ? (Number(feeWalletUsdcBalance) / 1e18).toFixed(4) : '0'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-sm ${subtleText}`}>USDT collected</span>
                  <span className="font-mono font-semibold">{feeWalletUsdtBalance ? (Number(feeWalletUsdtBalance) / 1e18).toFixed(4) : '0'}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <footer className={`border-t ${cardBorder} mt-12`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <OpenSpaceLogo className="h-9 w-auto" />
          <p className={`text-xs ${subtleText}`}>Running on BNB Smart Chain Testnet</p>
        </div>
      </footer>

      {sellerRegOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setSellerRegOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{sellerProfile ? 'Edit Shop Profile' : 'Set Up Your Shop'}</h3>
              <button onClick={() => setSellerRegOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>
            <div className="space-y-3 mb-5">
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Shop Name</label>
                <input type="text" value={shopNameInput} onChange={(e) => setShopNameInput(e.target.value)} placeholder="e.g. Kemi's Closet" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              </div>
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Short Bio (optional)</label>
                <textarea value={shopBioInput} onChange={(e) => setShopBioInput(e.target.value)} placeholder="What do you sell?" rows={3} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors resize-none`} />
              </div>
            </div>
            <button onClick={saveSellerProfile} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">
              Save Changes
            </button>
          </div>
        </div>
      )}

      {purchasesOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setPurchasesOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">My Purchases</h3>
              <button onClick={() => setPurchasesOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>
            {myPurchases.length === 0 ? (
              <p className={`${subtleText} text-sm py-8 text-center`}>You haven't bought anything yet.</p>
            ) : (
              <div className="space-y-4">
                {myPurchases.map((item) => renderItemCard(item, 'shop'))}
              </div>
            )}
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setSettingsOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-sm border ${cardBorder}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Wallet Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Wallet Address</label>
                <button
                  onClick={copySettingsAddress}
                  className={`w-full px-3 py-3 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-50 hover:bg-zinc-100'} border ${cardBorder} rounded-xl text-xs font-mono text-left break-all transition-colors`}
                >
                  {settingsAddressCopied ? '✓ Copied to clipboard!' : address}
                </button>
              </div>

              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Balance</label>
                <div className={`px-3 py-3 ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} rounded-xl text-sm font-mono space-y-1`}>
                  <div className="flex justify-between">
                    <span>tBNB</span>
                    <span>{myBnbBalance ? Number(formatEther(myBnbBalance.value)).toFixed(4) : 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>USDC</span>
                    <span>{myUsdcBalance !== undefined ? (Number(myUsdcBalance) / 1e18).toFixed(4) : 'Loading...'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>USDT</span>
                    <span>{myUsdtBalance !== undefined ? (Number(myUsdtBalance) / 1e18).toFixed(4) : 'Loading...'}</span>
                  </div>
                </div>
                <p className={`text-[11px] ${subtleText} mt-1`}>Need funds? Get free test tBNB (and USDC/USDT) at testnet.bnbchain.org/faucet-smart</p>
              </div>

              <div className={`border-t ${cardBorder} pt-4`}>
                {hasEmbeddedWallet ? (
                  <>
                    <button
                      onClick={() => exportWallet()}
                      className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity"
                    >
                      🔐 Back Up Wallet
                    </button>
                    <p className={`text-[11px] ${subtleText} mt-2`}>
                      This opens a secure screen where you can view and copy your private key or recovery phrase. Never share this with anyone.
                    </p>
                  </>
                ) : (
                  <p className={`text-xs ${subtleText}`}>
                    You're connected with an external wallet (like MetaMask). Your recovery phrase and backup are managed directly in that wallet app, not here.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {quickViewItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[65] p-4" onClick={() => setQuickViewId(null)}>
          <div className={`${cardBg} rounded-3xl w-full max-w-md border ${cardBorder} overflow-hidden max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className={`w-full aspect-square ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} relative`}>
              <img
                src={quickViewItem.imageUrl && quickViewItem.imageUrl.trim() !== '' ? quickViewItem.imageUrl : FALLBACK_IMAGE}
                alt={quickViewItem.name}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <button onClick={() => setQuickViewId(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">✕</button>
              <button
                onClick={() => toggleCart(quickViewItem.id, quickViewItem.paymentToken)}
                className={`absolute bottom-3 right-3 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg transition-all ${cart.includes(quickViewItem.id) ? 'bg-sky-400 text-zinc-900' : 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900'}`}
                title={cart.includes(quickViewItem.id) ? 'Remove from cart' : 'Add to cart'}
              >
                {cart.includes(quickViewItem.id) ? '✓' : '🛒'}
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                <span className="text-[11px] uppercase tracking-wider text-lime-600 font-semibold">Verified on-chain</span>
              </div>
              <h3 className="font-semibold text-xl mb-2">{quickViewItem.name}</h3>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient(quickViewItem.seller)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                  {quickViewItem.seller.slice(2, 4).toUpperCase()}
                </div>
                <p className={`text-xs ${subtleText} font-mono`}>{quickViewItem.seller.slice(0, 6)}...{quickViewItem.seller.slice(-4)}</p>
              </div>
              <span className="text-2xl font-mono block bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
                {(Number(quickViewItem.price) / 1e18).toString()} {currencySymbol(quickViewItem.paymentToken)}
              </span>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[65] p-4" onClick={() => setCartOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Your Cart</h3>
              <button onClick={() => setCartOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>

            {cart.length === 0 ? (
              <p className={`${subtleText} text-sm py-8 text-center`}>Your cart is empty. Tap any item to add it.</p>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  {cart.map((id) => {
                    const item = allItems.find((i) => i.id === id);
                    if (!item) return null;
                    const displayImage = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : FALLBACK_IMAGE;
                    return (
                      <div key={id} className={`flex items-center gap-3 p-2 rounded-xl border ${cardBorder}`}>
                        <img src={displayImage} alt={item.name} className="w-14 h-14 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-sm font-mono text-lime-500">{(Number(item.price) / 1e18).toString()} {currencySymbol(item.paymentToken)}</p>
                        </div>
                        <button onClick={() => toggleCart(id, item.paymentToken)} className="text-red-500 text-xs font-medium shrink-0 px-2">Remove</button>
                      </div>
                    );
                  })}
                </div>

                <div className={`mb-5 p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} space-y-1.5`}>
                  <div className="flex justify-between text-sm">
                    <span className={subtleText}>Subtotal</span>
                    <span className="font-mono">{(Number(cartSubtotal) / 1e18).toFixed(4)} {cartCurrency ? currencySymbol(cartCurrency) : ''}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={subtleText}>Buyer fee ({buyerFeePct}%)</span>
                    <span className="font-mono">{(Number(cartTotal - cartSubtotal) / 1e18).toFixed(4)} {cartCurrency ? currencySymbol(cartCurrency) : ''}</span>
                  </div>
                  <div className={`flex justify-between text-sm font-semibold pt-1.5 border-t ${cardBorder}`}>
                    <span>Total</span>
                    <span className="font-mono text-lime-500">{(Number(cartTotal) / 1e18).toFixed(4)} {cartCurrency ? currencySymbol(cartCurrency) : ''}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {!isConnected ? (
                    <button onClick={() => { setCartOpen(false); openWalletChoice(); }} className={`w-full py-3 ${darkMode ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'} rounded-2xl font-medium transition-colors`}>
                      Connect to Checkout
                    </button>
                  ) : (
                    <button onClick={() => { setCartOpen(false); openShippingModal('cart'); }} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                      Checkout
                    </button>
                  )}
                  <button onClick={() => { setCart([]); setCartCurrency(null); }} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
                    Clear Cart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {shippingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`}>
            <h3 className="font-semibold text-lg mb-1">Shipping Details</h3>
            <p className={`text-xs ${subtleText} mb-4`}>Stored privately in your browser — never sent to the blockchain.</p>
            <div className="space-y-3 mb-5">
              <input type="text" placeholder="Full Name" value={shippingForm.fullName} onChange={(e) => setShippingForm({ ...shippingForm, fullName: e.target.value })} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              <input type="text" placeholder="Street Address" value={shippingForm.address} onChange={(e) => setShippingForm({ ...shippingForm, address: e.target.value })} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="City" value={shippingForm.city} onChange={(e) => setShippingForm({ ...shippingForm, city: e.target.value })} className={`${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                <input type="text" placeholder="Country" value={shippingForm.country} onChange={(e) => setShippingForm({ ...shippingForm, country: e.target.value })} className={`${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              </div>
              <input type="text" placeholder="Phone (optional)" value={shippingForm.phone} onChange={(e) => setShippingForm({ ...shippingForm, phone: e.target.value })} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
            </div>

            {checkoutSummary && (
              <div className={`mb-5 p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} space-y-1.5`}>
                <div className="flex justify-between text-sm">
                  <span className={subtleText}>Subtotal</span>
                  <span className="font-mono">{(Number(checkoutSummary.subtotal) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={subtleText}>Buyer fee ({buyerFeePct}%)</span>
                  <span className="font-mono">{(Number(checkoutSummary.fee) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span>
                </div>
                <div className={`flex justify-between text-sm font-semibold pt-1.5 border-t ${cardBorder}`}>
                  <span>Total</span>
                  <span className="font-mono text-lime-500">{(Number(checkoutSummary.total) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button onClick={confirmShippingAndBuy} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                {isPending ? 'Confirm in wallet...' : 'Buy / Pay'}
              </button>
              <button onClick={() => setShippingModal(null)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {disputeCenterOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`}>
            <h3 className="font-semibold text-lg mb-1">Open a Dispute</h3>
            <p className={`text-xs ${subtleText} mb-4`}>Select the trade you have an issue with.</p>
            <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
              {disputeEligible.map((item) => {
                const role = address?.toLowerCase() === item.buyer.toLowerCase() ? 'Buyer' : 'Seller';
                return (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border ${cardBorder}`}>
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className={`text-xs ${subtleText}`}>You are the {role}</p>
                    </div>
                    <button
                      onClick={() => { call('raiseDispute', [BigInt(item.id)]); setDisputeCenterOpen(false); }}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      Raise Dispute
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setDisputeCenterOpen(false)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
              Close
            </button>
          </div>
        </div>
      )}

      {resolveCenterOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`}>
            <h3 className="font-semibold text-lg mb-1">Resolve Disputes</h3>
            <p className={`text-xs ${subtleText} mb-4`}>Review and settle each disputed trade.</p>
            <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
              {disputedItems.map((item) => (
                <div key={item.id} className={`p-3 rounded-xl border ${cardBorder}`}>
                  <p className="font-medium text-sm mb-2">{item.name} — {(Number(item.price) / 1e18).toString()} {currencySymbol(item.paymentToken)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => call('resolveDispute', [BigInt(item.id), true])} disabled={isPending} className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">Pay Seller</button>
                    <button onClick={() => call('resolveDispute', [BigInt(item.id), false])} disabled={isPending} className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">Refund Buyer</button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setResolveCenterOpen(false)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
              Close
            </button>
          </div>
        </div>
      )}

      {walletChoiceOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-sm border ${cardBorder} max-h-[90vh] overflow-y-auto`}>
            <h3 className="font-semibold text-lg mb-1">Connect Your Wallet</h3>
            <p className={`text-xs ${subtleText} mb-4`}>New here? Pick any option below — a wallet is created for you automatically.</p>

            {oauthErr && (
              <div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                <p className="text-xs text-red-500 font-medium">{oauthErr}</p>
              </div>
            )}

            {privyAuthenticated && !isConnected && (
              <div className="mb-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-xs text-sky-600 font-medium">Setting up your wallet, one moment...</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={handleGoogleLogin}
                disabled={!privyReady}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} font-medium text-sm disabled:opacity-50`}
              >
                <span className="w-5 h-5 rounded-full bg-white border border-zinc-300 flex items-center justify-center text-[11px] font-bold text-blue-500">G</span>
                Google
              </button>
              <button
                onClick={handleTwitterLogin}
                disabled={!privyReady}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} font-medium text-sm disabled:opacity-50`}
              >
                <span className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-[11px] font-bold text-white">𝕏</span>
                X
              </button>
            </div>

            <button
              onClick={handlePasskeyLogin}
              disabled={!privyReady}
              className={`w-full flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} font-medium text-sm disabled:opacity-50 mb-3`}
            >
              🔑 Continue with Passkey
            </button>

            <div className={`p-3 rounded-2xl border ${cardBorder} mb-3`}>
              {emailStep === 'input' ? (
                <div className="space-y-2">
                  <label className={`text-xs ${subtleText} block`}>Or continue with email</label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-3 py-2 outline-none focus:border-lime-400 text-sm`}
                  />
                  <button
                    onClick={handleSendCode}
                    disabled={emailBusy || !emailInput.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    {emailBusy ? 'Sending...' : 'Send Code'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`text-xs ${subtleText} block`}>Enter the code sent to {emailInput}</label>
                  <input
                    type="text"
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="123456"
                    className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-3 py-2 outline-none focus:border-lime-400 text-sm tracking-widest`}
                  />
                  <button
                    onClick={handleVerifyCode}
                    disabled={emailBusy || !codeInput.trim()}
                    className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50"
                  >
                    {emailBusy ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                  <button onClick={resetEmailFlow} className={`w-full text-xs ${subtleText} py-1`}>
                    Use a different email
                  </button>
                </div>
              )}
              {emailErr && <p className="text-xs text-red-500 mt-2">{emailErr}</p>}
            </div>

            <div className={`flex items-center gap-3 mb-3`}>
              <div className={`flex-1 h-px ${darkMode ? 'bg-white/10' : 'bg-zinc-200'}`} />
              <span className={`text-xs ${subtleText}`}>or use your own wallet</span>
              <div className={`flex-1 h-px ${darkMode ? 'bg-white/10' : 'bg-zinc-200'}`} />
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={() => { connectWallet(); setWalletChoiceOpen(false); }}
                className={`w-full py-3 px-4 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} text-left font-medium transition-colors`}
              >
                Connect Existing Wallet
                <span className={`block text-xs font-normal mt-0.5 ${subtleText}`}>MetaMask, WalletConnect, Coinbase Wallet, and more</span>
              </button>
            </div>

            <button onClick={() => { setWalletChoiceOpen(false); resetEmailFlow(); setOauthErr(''); }} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {helpModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-lg border ${cardBorder} max-h-[85vh] overflow-y-auto`}>
            <h3 className="font-semibold text-xl mb-1">Welcome to {BRAND_NAME} 👋</h3>
            <p className={`text-sm ${subtleText} mb-5`}>This is a testnet — everything here uses fake, free test money. Nothing costs real funds. Here's how to get started:</p>

            <div className="space-y-4 mb-6">
              <div>
                <p className="font-semibold text-sm mb-1">1. Connect</p>
                <p className={`text-sm ${subtleText} mb-2`}>Tap the ☰ menu, then <strong>Connect Wallet</strong>. The easiest way in is <strong>Google, X, Passkey, or email</strong> — no wallet app needed, we create one for you automatically.</p>
              </div>

              <div>
                <p className="font-semibold text-sm mb-1">Prefer your own wallet?</p>
                <p className={`text-sm ${subtleText} mb-2`}>You can still connect MetaMask or WalletConnect from the same screen. If so:</p>
                <ul className={`text-sm ${subtleText} list-disc list-inside space-y-1`}>
                  <li>On desktop: install the <strong>MetaMask</strong> browser extension from metamask.io</li>
                  <li>On mobile: install the <strong>MetaMask</strong> or <strong>Trust Wallet</strong> app from your app store</li>
                </ul>
              </div>

              <div className={`p-3 rounded-xl ${darkMode ? 'bg-amber-400/10 border-amber-400/30' : 'bg-amber-50 border-amber-200'} border`}>
                <p className="font-semibold text-sm mb-1">⚠️ If you use your own wallet</p>
                <p className={`text-sm ${subtleText}`}>
                  You'll be shown 12 words called a <strong>Secret Recovery Phrase</strong>. Write it down on paper and keep it somewhere safe.
                  <strong> Never</strong> type it into any website, never share it with anyone (including us), and never take a screenshot of it.
                </p>
              </div>

              <div>
                <p className="font-semibold text-sm mb-1">2. Add BNB Smart Chain Testnet (own wallet only)</p>
                <div className={`text-xs ${subtleText} p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} space-y-1 font-mono`}>
                  <p>Network Name: BNB Smart Chain Testnet</p>
                  <p>RPC URL: https://data-seed-prebsc-1-s1.bnbchain.org:8545</p>
                  <p>Chain ID: 97</p>
                  <p>Currency Symbol: tBNB</p>
                  <p>Explorer: https://testnet.bscscan.com</p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-sm mb-1">3. Get free test BNB</p>
                <p className={`text-sm ${subtleText}`}>Visit <span className="text-sky-500">testnet.bnbchain.org/faucet-smart</span>, paste your wallet address, and claim free tBNB (and optionally test USDC/USDT).</p>
              </div>

              <div>
                <p className="font-semibold text-sm mb-1">4. Try it out</p>
                <p className={`text-sm ${subtleText}`}>Tap any item and use the cart icon on the image to add it to your basket, then tap the cart icon at the top to checkout. Funds are held safely in escrow until you confirm receipt — try releasing funds, cancelling, or raising a dispute to see the full flow.</p>
              </div>
            </div>

            <button onClick={() => setHelpModalOpen(false)} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">
              Got it, let's go
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
