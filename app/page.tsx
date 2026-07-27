'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
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
const CONNECT_TIMEOUT_MS = 20000;

const CATEGORIES = ['Electronics', 'Clothing', 'Shoes', 'Home & Furniture', 'Beauty & Health', 'Toys & Games', 'Other'];

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
  const [connectTimeoutMsg, setConnectTimeoutMsg] = useState<string | null>(null);
  const [connectingConnectorId, setConnectingConnectorId] = useState<string | null>(null);
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem(ONBOARDING_SEEN_KEY);
    if (!seen) {
      setHelpModalOpen(true);
      localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
    }
  }, []);

  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const openWalletChoice = () => {
    setConnectTimeoutMsg(null);
    setWalletChoiceOpen(true);
  };

  const chooseConnector = (connector: any) => {
    setConnectTimeoutMsg(null);
    connect({ connector });
    setWalletChoiceOpen(false);

    const isInjected = connector.type === 'injected';
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    if (!isInjected) {
      setConnectingConnectorId(connector.uid);
      connectTimeoutRef.current = setTimeout(() => {
        setConnectTimeoutMsg("Connection timed out — the wallet app didn't respond. Please try again, or use a different connection method.");
        setConnectingConnectorId(null);
      }, CONNECT_TIMEOUT_MS);
    }
  };

  const dismissConnectTimeout = () => setConnectTimeoutMsg(null);

  useEffect(() => {
    if (isConnected) {
      if (connectTimeoutRef.current) {
        clearTimeout(connectTimeoutRef.current);
        connectTimeoutRef.current = null;
      }
      setConnectingConnectorId(null);
      setConnectTimeoutMsg(null);
    }
  }, [isConnected]);

  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
  }, []);

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
    if (filterAddress !== null && item.paymentToken.toLowerCase() !== filterAddress.toLowerCase()) return false;
    if (viewCategory !== ALL_CATEGORIES && item.category !== viewCategory) return false;
    if (searchQuery.trim() && !item.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    return true;
  });

  const myListings = isConnected
    ? allItems.filter((item) => item.seller.toLowerCase() === address?.toLowerCase() && !(item.delisted && !item.sold))
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

  const renderItemCard = (item: ParsedItem, context: 'shop' | 'sell') => {
    const { id, name, imageUrl, category, price, seller, buyer, sold, released, cancelled, shippingStatus, paymentToken, disputed } = item;
    const isSeller = isConnected && address?.toLowerCase() === seller?.toLowerCase();
    const inCart = cart.includes(id);
    const displayImage = imageUrl && imageUrl.trim() !== '' ? imageUrl : FALLBACK_IMAGE;
    const shipInfo = sold && context === 'sell' ? getShippingInfo(id, buyer) : null;
    const symbol = currencySymbol(paymentToken);

    return (
      <div key={id} className={`group relative ${cardBg} rounded-3xl overflow-hidden border ${inCart ? 'border-sky-400' : cardBorder} hover:border-lime-400/60 transition-all duration-300 hover:shadow-[0_0_25px_rgba(163,230,53,0.15)]`}>
        <div className={`w-full aspect-square ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} overflow-hidden relative`}>
          <img src={displayImage} alt={name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
          {category && (
            <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold ${darkMode ? 'bg-zinc-950/80 text-white' : 'bg-white/90 text-zinc-900'} backdrop-blur-sm`}>
              {category}
            </span>
          )}
        </div>
        <div className="p-6">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
            <span className="text-[11px] uppercase tracking-wider text-lime-600 font-semibold">Verified on-chain</span>
          </div>
          <h3 className="font-semibold text-xl mb-2">{name}</h3>

          {context === 'shop' ? (
            <div className="flex items-center gap-2 mb-4">
              <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${avatarGradient(seller)} flex items-center justify-center text-[9px] font-bold text-white shrink-0`}>
                {seller.slice(2, 4).toUpperCase()}
              </div>
              <p className={`text-xs ${subtleText} font-mono`}>{seller.slice(0, 6)}...{seller.slice(-4)}</p>
            </div>
          ) : (
            <p className={`text-xs ${subtleText} font-mono mb-4`}>{sold ? `Buyer: ${buyer.slice(0, 6)}...${buyer.slice(-4)}` : 'Not sold yet'}</p>
          )}

          <span className="text-2xl font-mono block mb-4 bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
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

          {context === 'shop' && !sold ? (
            !isConnected ? (
              <button onClick={openWalletChoice} className={`w-full py-2.5 ${darkMode ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'} rounded-2xl font-medium transition-colors`}>
                Connect to Buy
              </button>
            ) : (
              <div className="space-y-2">
                <button onClick={() => openShippingModal('single', id)} disabled={isPending} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 active:scale-[0.985] transition-all disabled:opacity-50">
                  {isPending ? 'Confirm in wallet...' : 'Buy Now'}
                </button>
                <button onClick={() => toggleCart(id, paymentToken)} className={`w-full py-2 rounded-xl text-sm font-medium transition-colors border ${inCart ? 'bg-sky-400 text-zinc-900 border-sky-400' : `${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} ${cardBorder}`}`}>
                  {inCart ? '✓ In Cart' : 'Add to Cart'}
                </button>
              </div>
            )
          ) : context === 'sell' && !sold ? (
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

  return (
    <div className={`min-h-screen ${bg} ${text} transition-colors duration-300 pb-24 flex flex-col`}>
      <header className={`border-b ${cardBorder} sticky top-0 ${headerBg} backdrop-blur-xl z-50`}>
        <div className="max-w-6xl mx-auto px-8 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-lime-400 to-sky-400 flex items-center justify-center shadow-[0_0_15px_rgba(163,230,53,0.4)]">
                <span className="text-zinc-900 font-bold text-xl">O</span>
              </div>

              <div className={`flex items-center gap-1 p-1 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder}`}>
                <button onClick={() => setActiveTab('shop')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'shop' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>
                  🛍 Buy
                </button>
                <button onClick={() => setActiveTab('sell')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'sell' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>
                  🏪 Sell
                </button>
                {isAdmin && (
                  <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === 'analytics' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>
                    📊 Analytics
                  </button>
                )}
              </div>
            </div>

            {activeTab === 'shop' && (
              <div className={`flex-1 max-w-xl flex items-center ${inputBg} border ${cardBorder} rounded-full overflow-hidden`}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search items..."
                  className="flex-1 bg-transparent px-5 py-2.5 outline-none text-sm"
                />
                <button title="Visual search — coming soon" className={`px-3 ${subtleText} hover:${text} transition-colors`} onClick={() => alert('Visual/camera search is a planned future feature.')}>
                  📷
                </button>
                <div className="w-9 h-9 mr-1 rounded-full bg-gradient-to-r from-lime-400 to-sky-400 flex items-center justify-center text-zinc-900">
                  🔍
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setHelpModalOpen(true)} title="How to test" className={`w-10 h-10 rounded-full border ${cardBorder} flex items-center justify-center hover:opacity-80 transition-opacity font-semibold`}>
                ❓
              </button>

              {activeTab === 'shop' && (
                <>
                  <select value={viewCategory} onChange={(e) => setViewCategory(e.target.value)} className={`px-3 py-2 rounded-xl text-sm font-medium ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder} outline-none focus:border-lime-400`}>
                    <option value={ALL_CATEGORIES}>{ALL_CATEGORIES}</option>
                    {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <select value={viewCurrency} onChange={(e) => setViewCurrency(e.target.value)} className={`px-3 py-2 rounded-xl text-sm font-medium ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder} outline-none focus:border-lime-400`}>
                    {Object.keys(VIEW_CURRENCIES).map((key) => (<option key={key} value={key}>{VIEW_CURRENCIES[key].label}</option>))}
                  </select>
                </>
              )}

              {isConnected && disputeEligible.length > 0 && (
                <button onClick={() => setDisputeCenterOpen(true)} className="px-3 py-2 rounded-xl text-sm font-medium border border-red-400/40 text-red-500 hover:bg-red-500/10 transition-colors">
                  ⚠ Open Dispute
                </button>
              )}
              {isAdmin && disputedItems.length > 0 && (
                <button onClick={() => setResolveCenterOpen(true)} className="px-3 py-2 rounded-xl text-sm font-medium border border-amber-400/40 text-amber-600 hover:bg-amber-400/10 transition-colors">
                  Resolve Disputes ({disputedItems.length})
                </button>
              )}

              <button onClick={() => setDarkMode(!darkMode)} className={`w-10 h-10 rounded-full border ${cardBorder} flex items-center justify-center hover:opacity-80 transition-opacity`}>
                {darkMode ? '☀️' : '🌙'}
              </button>

              {isConnected ? (
                <div className="flex items-center gap-3">
                  {isAdmin && <span className="px-3 py-1.5 bg-amber-400/20 text-amber-600 border border-amber-400/40 rounded-xl text-xs font-semibold">ADMIN</span>}
                  <span className={`px-4 py-2 ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder} rounded-2xl text-sm font-mono`}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <button onClick={() => disconnect()} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl text-sm font-medium transition-colors">Disconnect</button>
                </div>
              ) : (
                <button onClick={openWalletChoice} className="px-5 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-12 flex-1 w-full">
        {activeTab === 'shop' ? (
          <>
            <div className="mb-8">
              <h2 className="text-5xl font-black tracking-tighter mb-3">
                The Marketplace,<br />
                <span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Decentralized.</span>
              </h2>
              <p className={`${subtleText} text-lg`}>
                {viewCategory !== ALL_CATEGORIES ? `${viewCategory} — ` : ''}{viewCurrency === ALL_KEY ? 'showing items in all currencies' : `showing items priced in ${VIEW_CURRENCIES[viewCurrency].label}`} — funds held in escrow until you confirm.
              </p>
            </div>

            {count === 0 ? (
              <p className={subtleText}>No items listed yet.</p>
            ) : shopItems.length === 0 ? (
              <p className={subtleText}>No items found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {shopItems.map((item) => renderItemCard(item, 'shop'))}
              </div>
            )}
          </>
        ) : activeTab === 'sell' ? (
          <>
            <div className="mb-10 flex items-start justify-between gap-6 flex-wrap">
              <div>
                <h2 className="text-5xl font-black tracking-tighter mb-3">
                  Seller<br />
                  <span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Dashboard.</span>
                </h2>
                <p className={`${subtleText} text-lg`}>Manage your listings, shipments, and sales.</p>
              </div>
              {isConnected && (
                <button onClick={() => setShowListForm(!showListForm)} className="px-6 py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_0_15px_rgba(163,230,53,0.3)]">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {myListings.map((item) => renderItemCard(item, 'sell'))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="mb-10">
              <h2 className="text-5xl font-black tracking-tighter mb-3">
                Platform<br />
                <span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Analytics.</span>
              </h2>
              <p className={`${subtleText} text-lg`}>Live stats pulled directly from the smart contract.</p>
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
        <div className="max-w-6xl mx-auto px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-lime-400 to-sky-400 flex items-center justify-center">
              <span className="text-zinc-900 font-bold text-xs">O</span>
            </div>
            <span className={`text-sm ${subtleText}`}>Decentralized, escrow-protected, testnet build</span>
          </div>
          <p className={`text-xs ${subtleText}`}>Running on BNB Smart Chain Testnet</p>
        </div>
      </footer>

      {connectTimeoutMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-md w-[90%]">
          <div className={`${cardBg} border border-red-400/40 rounded-2xl p-4 shadow-lg flex items-start gap-3`}>
            <span className="text-red-500 text-lg">⚠</span>
            <div className="flex-1">
              <p className="text-sm font-medium mb-2">{connectTimeoutMsg}</p>
              <div className="flex gap-2">
                <button onClick={() => { dismissConnectTimeout(); openWalletChoice(); }} className="px-3 py-1.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-lg text-xs font-semibold">
                  Try Again
                </button>
                <button onClick={dismissConnectTimeout} className={`px-3 py-1.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-lg text-xs font-medium`}>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cart.length > 0 && cartCurrency && activeTab === 'shop' && (
        <div className={`fixed bottom-0 left-0 right-0 ${cardBg} border-t ${cardBorder} backdrop-blur-xl z-50`}>
          <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-semibold">{cart.length} item{cart.length > 1 ? 's' : ''} in cart</span>
              <span className={`ml-3 ${subtleText}`}>Subtotal: <span className="text-lime-500 font-mono">{(Number(cartSubtotal) / 1e18).toFixed(4)} {currencySymbol(cartCurrency)}</span></span>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setCart([]); setCartCurrency(null); }} className={`px-4 py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Clear Cart</button>
              <button onClick={() => openShippingModal('cart')} disabled={isPending} className="px-6 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                {isPending ? 'Confirm in wallet...' : 'Checkout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {shippingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
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
                {isPending ? 'Confirm in wallet...' : 'Confirm & Pay'}
              </button>
              <button onClick={() => setShippingModal(null)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {disputeCenterOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-sm border ${cardBorder}`}>
            <h3 className="font-semibold text-lg mb-1">Connect Your Wallet</h3>
            <p className={`text-xs ${subtleText} mb-4`}>Choose how you'd like to connect. On mobile, WalletConnect usually works best.</p>
            <div className="space-y-2 mb-4">
              {(() => {
                const injectedConnectors = connectors.filter((c) => c.type === 'injected');
                const hasSingleInjected = injectedConnectors.length <= 1;
                return connectors.map((connector) => {
                  const isInjected = connector.type === 'injected';
                  const injectedAvailable = typeof window !== 'undefined' && !!(window as any).ethereum;
                  const useGenericLabel = isInjected && hasSingleInjected;
                  const label = useGenericLabel
                    ? (injectedAvailable ? "Continue with this Wallet" : 'Browser Extension (MetaMask, etc.)')
                    : connector.name;
                  const isConnectingThis = connectingConnectorId === connector.uid;

                  return (
                    <button
                      key={connector.uid}
                      onClick={() => chooseConnector(connector)}
                      disabled={isConnectingThis}
                      className={`w-full py-3 px-4 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} text-left font-medium transition-colors disabled:opacity-50 ${isInjected && injectedAvailable ? 'ring-2 ring-lime-400' : ''}`}
                    >
                      {label}
                      {isInjected && injectedAvailable && (
                        <span className={`block text-xs font-normal mt-0.5 ${subtleText}`}>Recommended — you're already in a wallet browser</span>
                      )}
                      {isConnectingThis && (
                        <span className="block text-xs font-normal mt-0.5 text-sky-500">Connecting...</span>
                      )}
                    </button>
                  );
                });
              })()}
            </div>
            {connectError && (
              <p className="text-xs text-red-500 mb-3">{connectError.message}</p>
            )}
            <button onClick={() => setWalletChoiceOpen(false)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {helpModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-lg border ${cardBorder} max-h-[85vh] overflow-y-auto`}>
            <h3 className="font-semibold text-xl mb-1">Welcome to {BRAND_NAME} 👋</h3>
            <p className={`text-sm ${subtleText} mb-5`}>This is a testnet — everything here uses fake, free test money. Nothing costs real funds. Here's how to get started:</p>

            <div className="space-y-4 mb-6">
              <div>
                <p className="font-semibold text-sm mb-1">1. Get a wallet</p>
                <p className={`text-sm ${subtleText} mb-2`}>A wallet is what lets you use this site. If you don't have one yet:</p>
                <ul className={`text-sm ${subtleText} list-disc list-inside space-y-1`}>
                  <li>On desktop: install the <strong>MetaMask</strong> browser extension from metamask.io</li>
                  <li>On mobile: install the <strong>MetaMask</strong> or <strong>Trust Wallet</strong> app from your app store</li>
                  <li>Open it and choose "Create a new wallet"</li>
                </ul>
              </div>

              <div className={`p-3 rounded-xl ${darkMode ? 'bg-amber-400/10 border-amber-400/30' : 'bg-amber-50 border-amber-200'} border`}>
                <p className="font-semibold text-sm mb-1">⚠️ Protect your Secret Recovery Phrase</p>
                <p className={`text-sm ${subtleText}`}>
                  When you create a wallet, you'll be shown 12 words called a <strong>Secret Recovery Phrase</strong>. Write it down on paper and keep it somewhere safe.
                  <strong> Never</strong> type it into any website, never share it with anyone (including us), and never take a screenshot of it. Anyone with those words can take everything in your wallet.
                </p>
              </div>

              <div>
                <p className="font-semibold text-sm mb-1">2. Add BNB Smart Chain Testnet</p>
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
                <p className="font-semibold text-sm mb-1">4. Connect your wallet</p>
                <p className={`text-sm ${subtleText}`}>Click "Connect Wallet" at the top right. On mobile, choose <strong>WalletConnect</strong> and scan the QR code (or follow the prompt to open your wallet app) — this tends to work more smoothly than a browser extension on phones.</p>
              </div>

              <div>
                <p className="font-semibold text-sm mb-1">5. Try it out</p>
                <p className={`text-sm ${subtleText}`}>Use <strong>Buy</strong> to browse and purchase items, or <strong>Sell</strong> to list your own. Funds are held safely in escrow until the buyer confirms — try releasing funds, cancelling, or raising a dispute to see the full flow.</p>
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