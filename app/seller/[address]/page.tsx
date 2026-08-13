'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSignMessage } from 'wagmi';
import { usePrivy, useLoginWithOAuth, useLoginWithEmail, useLoginWithPasskey, useConnectWallet } from '@privy-io/react-auth';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDT_ADDRESS, ERC20_ABI } from '../../contract';
import { supabase } from '../../supabaseClient';

const FALLBACK_IMAGE = 'https://placehold.co/400x400/e2e8f0/94a3b8?text=No+Image';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const NO_VARIANT = '';

type ShippingInfo = { fullName: string; address: string; city: string; country: string; phone: string };
const emptyShipping: ShippingInfo = { fullName: '', address: '', city: '', country: '', phone: '' };

type Listing = {
  id: number;
  name: string;
  imageUrl: string;
  category: string;
  price: bigint;
  seller: string;
  paymentToken: string;
  delisted: boolean;
  hasVariants: boolean;
  colors: string[];
  sizes: string[];
  simpleStock: bigint;
};

type CartLine = { listingId: number; color: string; size: string };

function currencySymbol(tokenAddress: string) {
  if (tokenAddress.toLowerCase() === ZERO_ADDRESS) return 'tBNB';
  if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) return 'USDC';
  if (tokenAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()) return 'USDT';
  return 'TOKEN';
}

// Same fixed gas price used site-wide - sidesteps MetaMask's unreliable
// automatic gas guessing on BSC-type chains (see main page.tsx for the
// full explanation of why this is necessary).
const SAFE_GAS_PRICE = BigInt(3000000000); // 3 Gwei

export default function SellerStorefrontPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cameFromOwnDashboard = searchParams.get('from') === 'dashboard';
  const sellerAddress = (Array.isArray(params?.address) ? params.address[0] : params?.address) || '';
  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(sellerAddress);

  const [profile, setProfile] = useState<{ shopName: string; bio: string } | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);

  const { address, isConnected } = useAccount();
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const { initOAuth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { connectWallet } = useConnectWallet();
  const { signMessageAsync } = useSignMessage();
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [walletChoiceOpen, setWalletChoiceOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'code'>('input');
  const [emailInput, setEmailInput] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [oauthErr, setOauthErr] = useState('');

  const resetEmailFlow = () => { setEmailStep('input'); setEmailInput(''); setCodeInput(''); setEmailErr(''); setEmailBusy(false); };
  const openWalletChoice = () => { resetEmailFlow(); setOauthErr(''); setWalletChoiceOpen(true); };
  const handleGoogleLogin = async () => {
    setOauthErr('');
    try { await initOAuth({ provider: 'google' }); } catch (e: any) { setOauthErr(e?.message || 'Google login failed. Please try again.'); }
  };
  const handleTwitterLogin = async () => {
    setOauthErr('');
    try { await initOAuth({ provider: 'twitter' }); } catch (e: any) { setOauthErr(e?.message || 'X login failed. Please try again.'); }
  };
  const handlePasskeyLogin = async () => {
    setOauthErr('');
    try { await loginWithPasskey(); } catch (e: any) { setOauthErr(e?.message || 'Passkey login failed. Please try again.'); }
  };
  const handleSendCode = async () => {
    if (!emailInput.trim()) return;
    setEmailBusy(true); setEmailErr('');
    try { await sendCode({ email: emailInput.trim() }); setEmailStep('code'); } catch (e) { setEmailErr('Could not send code. Check the email and try again.'); }
    setEmailBusy(false);
  };
  const handleVerifyCode = async () => {
    if (!codeInput.trim()) return;
    setEmailBusy(true); setEmailErr('');
    try { await loginWithCode({ code: codeInput.trim() }); } catch (e) { setEmailErr('Incorrect code. Please try again.'); }
    setEmailBusy(false);
  };

  useEffect(() => {
    if (isConnected && walletChoiceOpen) { setWalletChoiceOpen(false); resetEmailFlow(); setOauthErr(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const call = (functionName: string, args: any[], value?: bigint) => {
    writeContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: functionName as any, args: args as any, gasPrice: SAFE_GAS_PRICE, ...(value ? { value } : {}) } as any);
  };

  useEffect(() => {
    supabase.functions
      .invoke('seller-profiles', {
        body: { action: 'getProfile', contractAddress: MARKETPLACE_ADDRESS, walletAddress: sellerAddress },
      })
      .then(({ data, error }) => {
        if (!error && data?.data) {
          setProfile({ shopName: data.data.shop_name, bio: data.data.bio || '' });
        }
        setProfileChecked(true);
      })
      .catch(() => setProfileChecked(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerAddress]);

  // ---------- REVIEWS (public read - both the average summary and the full list) ----------
  const [reviews, setReviews] = useState<{ orderId: number; buyerAddress: string; rating: number; reviewText: string | null; createdAt: string }[]>([]);
  useEffect(() => {
    if (!isValidAddress) return;
    supabase.functions.invoke('reviews', {
      body: { action: 'getReviews', contractAddress: MARKETPLACE_ADDRESS, sellerAddress },
    }).then(({ data, error }) => {
      if (!error && data?.data) setReviews(data.data.map((r: any) => ({ orderId: r.order_id, buyerAddress: r.buyer_address, rating: r.rating, reviewText: r.review_text, createdAt: r.created_at })));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerAddress]);
  const ratingSummary = reviews.length > 0 ? { average: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length, count: reviews.length } : null;

  // ---------- LISTINGS ----------
  const { data: listingCount } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'listingCount' });
  const lCount = listingCount ? Number(listingCount) : 0;

  const listingContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getListing' as const, args: [BigInt(i + 1)] as const }));
  const variantContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getListingVariants' as const, args: [BigInt(i + 1)] as const }));
  const stockContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getAvailableStock' as const, args: [BigInt(i + 1), NO_VARIANT, NO_VARIANT] as const }));

  const { data: listingsData, refetch: refetchListings } = useReadContracts({ contracts: listingContracts, query: { enabled: lCount > 0 } });
  const { data: variantsData } = useReadContracts({ contracts: variantContracts, query: { enabled: lCount > 0 } });
  const { data: stockData, refetch: refetchStock } = useReadContracts({ contracts: stockContracts, query: { enabled: lCount > 0 } });

  const allListings: Listing[] = (() => {
    if (!listingsData || !variantsData || !stockData) return [];
    return listingsData.map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;
      const [name, imageUrl, category, price, seller, paymentToken, delisted, hasVariants] = result.result as [string, string, string, bigint, string, string, boolean, boolean];
      const variantResult = variantsData[index];
      const [colors, sizes] = variantResult.status === 'success' && variantResult.result ? (variantResult.result as [string[], string[]]) : [[], []];
      const stockResult = stockData[index];
      const simpleStock = stockResult.status === 'success' && stockResult.result !== undefined ? (stockResult.result as bigint) : BigInt(0);
      return { id: index + 1, name, imageUrl, category, price, seller, paymentToken, delisted, hasVariants, colors, sizes, simpleStock };
    }).filter((x): x is Listing => x !== null);
  })();

  const sellerListings = allListings.filter((l) => l.seller.toLowerCase() === sellerAddress.toLowerCase() && !l.delisted);
  const getListingById = (id: number) => allListings.find((l) => l.id === id);

  // ---------- QUICK VIEW ----------
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [pickedColor, setPickedColor] = useState('');
  const [pickedSize, setPickedSize] = useState('');

  const quickViewListing = quickViewId ? getListingById(quickViewId) ?? null : null;

  const qvVariantContracts = quickViewListing && quickViewListing.hasVariants
    ? quickViewListing.colors.flatMap((c) => quickViewListing.sizes.map((s) => ({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getAvailableStock' as const, args: [BigInt(quickViewListing.id), c, s] as const,
      })))
    : [];
  const { data: qvStockData } = useReadContracts({ contracts: qvVariantContracts, query: { enabled: qvVariantContracts.length > 0 } });

  const qvColorImageContracts = quickViewListing && quickViewListing.hasVariants
    ? quickViewListing.colors.map((c) => ({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getColorImage' as const, args: [BigInt(quickViewListing.id), c] as const,
      }))
    : [];
  const { data: qvColorImageData } = useReadContracts({ contracts: qvColorImageContracts, query: { enabled: qvColorImageContracts.length > 0 } });

  const getQvDisplayImage = (): string => {
    if (!quickViewListing) return FALLBACK_IMAGE;
    if (quickViewListing.hasVariants && pickedColor && qvColorImageData) {
      const ci = quickViewListing.colors.indexOf(pickedColor);
      const r = qvColorImageData[ci];
      const colorImg = r && r.status === 'success' && typeof r.result === 'string' ? r.result : '';
      if (colorImg && colorImg.trim() !== '') return colorImg;
    }
    return quickViewListing.imageUrl && quickViewListing.imageUrl.trim() !== '' ? quickViewListing.imageUrl : FALLBACK_IMAGE;
  };

  const getQvStock = (color: string, size: string): number => {
    if (!quickViewListing || !quickViewListing.hasVariants || !qvStockData) return 0;
    const ci = quickViewListing.colors.indexOf(color);
    const si = quickViewListing.sizes.indexOf(size);
    const idx = ci * quickViewListing.sizes.length + si;
    const r = qvStockData[idx];
    return r && r.status === 'success' && r.result !== undefined ? Number(r.result) : 0;
  };

  useEffect(() => {
    setZoomActive(false);
    setZoomOrigin({ x: 50, y: 50 });
    setPickedColor('');
    setPickedSize('');
  }, [quickViewId]);

  const qvHasColors = quickViewListing ? quickViewListing.colors.some((c) => c !== NO_VARIANT) : false;
  const qvHasSizes = quickViewListing ? quickViewListing.sizes.some((s) => s !== NO_VARIANT) : false;
  const qvColorReady = !qvHasColors || !!pickedColor;
  const qvSizeReady = !qvHasSizes || !!pickedSize;
  const canAddQuickViewToCart = quickViewListing && (!quickViewListing.hasVariants || (qvColorReady && qvSizeReady && getQvStock(qvHasColors ? pickedColor : NO_VARIANT, qvHasSizes ? pickedSize : NO_VARIANT) > 0));
  const isOwnQuickViewListing = quickViewListing && address && quickViewListing.seller.toLowerCase() === address.toLowerCase();

  // ---------- CART ----------
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartCurrency, setCartCurrency] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const addToCart = (listing: Listing, color: string, size: string) => {
    if (cartCurrency && cartCurrency.toLowerCase() !== listing.paymentToken.toLowerCase()) {
      alert(`Your cart is currently in ${currencySymbol(cartCurrency)}. Clear it first to add items in a different currency.`);
      return;
    }
    setCart((prev) => [...prev, { listingId: listing.id, color, size }]);
    setCartCurrency(listing.paymentToken);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setCartCurrency(null);
      return next;
    });
  };

  const { data: buyerFeePercent } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'buyerFeePercent' });
  const buyerFeePct = buyerFeePercent ? Number(buyerFeePercent) : 0;
  const withBuyerFee = (price: bigint): bigint => price + (price * BigInt(buyerFeePct)) / BigInt(100);

  const cartSubtotal = cart.reduce((sum, line) => sum + (getListingById(line.listingId)?.price ?? BigInt(0)), BigInt(0));
  const cartTotal = withBuyerFee(cartSubtotal);
  const checkoutSummary = cart.length > 0 ? { subtotal: cartSubtotal, fee: cartTotal - cartSubtotal, total: cartTotal, symbol: cartCurrency ? currencySymbol(cartCurrency) : '' } : null;

  // ---------- CHECKOUT ----------
  const { data: orderCount, refetch: refetchOrderCount } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'orderCount' });
  const oCount = orderCount ? Number(orderCount) : 0;

  const [shippingModal, setShippingModal] = useState(false);
  const [shippingForm, setShippingForm] = useState<ShippingInfo>(emptyShipping);
  const [pendingTokenBuy, setPendingTokenBuy] = useState<{ lines: CartLine[]; token: string; totalDue: bigint } | null>(null);
  const [pendingShippingSave, setPendingShippingSave] = useState<{ info: ShippingInfo; startOrderCount: number; numItems: number; sellerAddresses: string[] } | null>(null);
  const [awaitingPurchaseTx, setAwaitingPurchaseTx] = useState(false);

  const proceedToCheckout = (lines: CartLine[], token: string) => {
    const subtotal = lines.reduce((sum, line) => sum + (getListingById(line.listingId)?.price ?? BigInt(0)), BigInt(0));
    const totalDue = withBuyerFee(subtotal);
    const listingIds = lines.map((l) => BigInt(l.listingId));
    const colors = lines.map((l) => l.color);
    const sizes = lines.map((l) => l.size);

    if (token.toLowerCase() === ZERO_ADDRESS) {
      call('buyMultiple', [listingIds, colors, sizes, token], totalDue);
      setAwaitingPurchaseTx(true);
    } else {
      setPendingTokenBuy({ lines, token, totalDue });
      writeContract({ address: token as `0x${string}`, abi: ERC20_ABI, functionName: 'approve', args: [MARKETPLACE_ADDRESS, totalDue], gasPrice: SAFE_GAS_PRICE });
    }
  };

  useEffect(() => {
    if (txConfirmed && pendingTokenBuy) {
      const listingIds = pendingTokenBuy.lines.map((l) => BigInt(l.listingId));
      const colors = pendingTokenBuy.lines.map((l) => l.color);
      const sizes = pendingTokenBuy.lines.map((l) => l.size);
      call('buyMultiple', [listingIds, colors, sizes, pendingTokenBuy.token]);
      setPendingTokenBuy(null);
      setAwaitingPurchaseTx(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed]);

  const saveShippingInfoForOrders = async (orderIds: number[], info: ShippingInfo, sellerAddresses: Record<number, string>) => {
    if (!address || orderIds.length === 0) return;
    try {
      const message = `OpenSpace shipping save | contract:${MARKETPLACE_ADDRESS.toLowerCase()} | orders:${orderIds.join(',')} | buyer:${address.toLowerCase()}`;
      const signature = await signMessageAsync({ message });
      await supabase.functions.invoke('shipping-info', {
        body: { action: 'save', contractAddress: MARKETPLACE_ADDRESS, buyerAddress: address, orderIds, sellerAddresses, info, message, signature },
      });
    } catch (e) {
      console.error('Shipping save failed or was rejected:', e);
    }
  };

  useEffect(() => {
    if (!(txConfirmed && awaitingPurchaseTx && pendingShippingSave)) return;
    (async () => {
      const result = await refetchOrderCount();
      const newCount = result.data ? Number(result.data) : oCount;
      const { startOrderCount, numItems, info, sellerAddresses } = pendingShippingSave;
      const newOrderIds = Array.from({ length: numItems }, (_, i) => startOrderCount + i + 1).filter((id) => id <= newCount);
      const sellerMap: Record<number, string> = {};
      newOrderIds.forEach((id, i) => { if (sellerAddresses[i]) sellerMap[id] = sellerAddresses[i]; });
      await saveShippingInfoForOrders(newOrderIds, info, sellerMap);
      setPendingShippingSave(null);
      setAwaitingPurchaseTx(false);
      refetchListings();
      refetchStock();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, awaitingPurchaseTx]);

  const confirmShippingAndBuy = () => {
    if (!shippingForm.fullName.trim() || !shippingForm.address.trim()) { alert('Please fill in at least your name and address'); return; }
    if (cart.length === 0 || !cartCurrency) return;
    const sellerAddresses = cart.map((line) => getListingById(line.listingId)?.seller || '');
    setPendingShippingSave({ info: shippingForm, startOrderCount: oCount, numItems: cart.length, sellerAddresses });
    proceedToCheckout(cart, cartCurrency);
    setCart([]);
    setCartCurrency(null);
    setShippingModal(false);
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 pb-16">
      <header className="border-b border-zinc-200 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
        {privyAuthenticated && !isConnected && (
          <div className="bg-sky-500 text-white text-xs font-medium py-2 px-4 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            Finishing sign-in, setting up your wallet...
          </div>
        )}
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
          {cameFromOwnDashboard ? (
            <Link href="/?tab=sell" className="text-sm font-semibold bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
              ← Back to Seller Dashboard
            </Link>
          ) : (
            <Link href="/" className="text-sm font-semibold bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
              ← Back to OpenSpace
            </Link>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setCartOpen(true)} className="relative w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-lg shadow-md shadow-sky-400/30">
              🛍️
              {cart.length > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{cart.length}</span>)}
            </button>
            {!isConnected && (
              <button onClick={openWalletChoice} className="px-4 py-2 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity">
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-10">
        {!isValidAddress ? (
          <p className="text-zinc-500">That doesn't look like a valid seller address.</p>
        ) : (
          <>
            <div className="mb-10">
              <div className="flex items-center gap-4 mb-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-lime-400 to-sky-400 flex items-center justify-center text-xl font-bold text-zinc-900 shrink-0">
                  {sellerAddress.slice(2, 4).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                      {profile?.shopName || (profileChecked ? 'Seller Storefront' : 'Loading...')}
                    </h1>
                    {profileChecked && profile && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-sky-400/10 text-sky-600 border border-sky-400/30">✓ Verified Seller</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-mono">{sellerAddress.slice(0, 6)}...{sellerAddress.slice(-4)}</p>
                  {ratingSummary && (
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <span className="text-amber-400">{'★'.repeat(Math.round(ratingSummary.average))}{'☆'.repeat(5 - Math.round(ratingSummary.average))}</span>
                      <span className="text-zinc-600">{ratingSummary.average.toFixed(1)} ({ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'})</span>
                    </p>
                  )}
                </div>
              </div>
              {profile?.bio && <p className="text-zinc-600 max-w-2xl">{profile.bio}</p>}
              {profileChecked && !profile && (
                <p className="text-sm text-zinc-500">This seller hasn't set up a shop profile yet.</p>
              )}
            </div>

            <h2 className="font-semibold text-lg mb-4">
              {sellerListings.length > 0 ? `${sellerListings.length} item${sellerListings.length === 1 ? '' : 's'} for sale` : 'No active listings'}
            </h2>

            {sellerListings.length === 0 ? (
              <p className="text-zinc-500">This seller doesn't have any active listings right now.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {sellerListings.map((listing) => {
                  const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
                  return (
                    <button
                      key={listing.id}
                      onClick={() => setQuickViewId(listing.id)}
                      className="group text-left bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:border-lime-400/60 transition-all duration-300"
                    >
                      <div className="w-full aspect-square bg-zinc-100 overflow-hidden relative">
                        <img
                          src={displayImage}
                          alt={listing.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-lime-400/90 text-zinc-900">🔒 Escrow</span>
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-sm font-medium truncate">{listing.name}</p>
                        <p className="text-xs font-mono text-lime-600">
                          {(Number(listing.price) / 1e18).toString()} {currencySymbol(listing.paymentToken)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {reviews.length > 0 && (
              <div className="mt-12">
                <h2 className="font-semibold text-lg mb-4">Reviews ({reviews.length})</h2>
                <div className="space-y-3 max-w-2xl">
                  {reviews.map((r) => (
                    <div key={r.orderId} className="p-4 rounded-2xl border border-zinc-200 bg-zinc-50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-amber-400 text-sm">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                        <span className="text-xs text-zinc-500 font-mono">{r.buyerAddress.slice(0, 6)}...{r.buyerAddress.slice(-4)}</span>
                      </div>
                      {r.reviewText && <p className="text-sm text-zinc-700">{r.reviewText}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* QUICK VIEW POPUP */}
      {quickViewListing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[65] p-4" onClick={() => setQuickViewId(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md border border-zinc-200 overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div
              className="w-full aspect-square bg-zinc-100 relative overflow-hidden"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setZoomOrigin({ x, y });
                setZoomActive(true);
              }}
              onMouseLeave={() => setZoomActive(false)}
              onTouchStart={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const touch = e.touches[0];
                const x = ((touch.clientX - rect.left) / rect.width) * 100;
                const y = ((touch.clientY - rect.top) / rect.height) * 100;
                setZoomOrigin({ x, y });
                setZoomActive(true);
              }}
              onTouchMove={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                const touch = e.touches[0];
                const x = ((touch.clientX - rect.left) / rect.width) * 100;
                const y = ((touch.clientY - rect.top) / rect.height) * 100;
                setZoomOrigin({ x, y });
              }}
              onTouchEnd={() => setZoomActive(false)}
            >
              <img
                src={getQvDisplayImage()}
                alt={quickViewListing.name}
                className={`w-full h-full object-cover ${zoomActive ? 'scale-[2.4]' : 'scale-100'} transition-transform duration-100 ease-out cursor-zoom-in`}
                style={{ transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}
                onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
              />
              <button onClick={() => setQuickViewId(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">✕</button>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                  <span className="text-[11px] uppercase tracking-wider text-lime-600 font-semibold">Verified on-chain</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-lime-400/10 text-lime-600 border border-lime-400/30">🔒 Escrow Protected</span>
                {profile && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-sky-400/10 text-sky-600 border border-sky-400/30">✓ Verified Seller</span>
                )}
              </div>
              {ratingSummary && (
                <p className="text-xs text-zinc-500 mb-2 flex items-center gap-1">
                  <span className="text-amber-400">{'★'.repeat(Math.round(ratingSummary.average))}{'☆'.repeat(5 - Math.round(ratingSummary.average))}</span>
                  {ratingSummary.average.toFixed(1)} ({ratingSummary.count} review{ratingSummary.count === 1 ? '' : 's'})
                </p>
              )}
              <h3 className="font-semibold text-xl mb-2">{quickViewListing.name}</h3>
              <span className="text-2xl font-mono block mb-4 bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
                {(Number(quickViewListing.price) / 1e18).toString()} {currencySymbol(quickViewListing.paymentToken)}
              </span>

              {quickViewListing.hasVariants ? (
                <>
                  {qvHasColors && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Color</p>
                      <div className="flex flex-wrap gap-2">
                        {quickViewListing.colors.map((c) => {
                          const anySizeAvailable = quickViewListing.sizes.some((s) => getQvStock(c, s) > 0);
                          return (
                            <button
                              key={c}
                              disabled={!anySizeAvailable}
                              onClick={() => { setPickedColor(c); setPickedSize(''); }}
                              className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${!anySizeAvailable ? 'opacity-30 cursor-not-allowed' : pickedColor === c ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 border-transparent' : 'border-zinc-200 hover:bg-zinc-50'}`}
                            >
                              {c}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {qvHasSizes && (
                    <div className="mb-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-2">Size</p>
                      <div className="flex flex-wrap gap-2">
                        {quickViewListing.sizes.map((s) => {
                          const available = (!qvHasColors || pickedColor) ? getQvStock(qvHasColors ? pickedColor : NO_VARIANT, s) > 0 : false;
                          return (
                            <button
                              key={s}
                              disabled={(qvHasColors && !pickedColor) || !available}
                              onClick={() => setPickedSize(s)}
                              className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${(qvHasColors && !pickedColor) || !available ? 'opacity-30 cursor-not-allowed' : pickedSize === s ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 border-transparent' : 'border-zinc-200 hover:bg-zinc-50'}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                      {qvColorReady && qvSizeReady && (
                        <p className="text-xs text-zinc-500 mt-2">{getQvStock(qvHasColors ? pickedColor : NO_VARIANT, qvHasSizes ? pickedSize : NO_VARIANT)} left in stock</p>
                      )}
                    </div>
                  )}
                  {!qvHasSizes && qvColorReady && (
                    <p className="text-xs text-zinc-500 mb-5">{getQvStock(qvHasColors ? pickedColor : NO_VARIANT, NO_VARIANT)} left in stock</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-zinc-500 mb-5">{quickViewListing.simpleStock.toString()} in stock</p>
              )}

              {isOwnQuickViewListing ? (
                <p className="text-xs text-zinc-500 text-center">This is your own listing. Manage it from your Seller Dashboard.</p>
              ) : !isConnected ? (
                <button onClick={openWalletChoice} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">
                  Login to Buy
                </button>
              ) : (
                <button
                  disabled={!canAddQuickViewToCart}
                  onClick={() => { addToCart(quickViewListing, quickViewListing.hasVariants ? pickedColor : '', quickViewListing.hasVariants ? pickedSize : ''); setQuickViewId(null); setCartOpen(true); }}
                  className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-40"
                >
                  {quickViewListing.hasVariants && !(qvColorReady && qvSizeReady) ? (!qvColorReady ? 'Select a color' : 'Select a size') : 'Add to Cart'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CART DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[65] p-4" onClick={() => setCartOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-zinc-200 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Your Cart</h3>
              <button onClick={() => setCartOpen(false)} className="w-8 h-8 rounded-full hover:bg-zinc-100 flex items-center justify-center">✕</button>
            </div>
            {cart.length === 0 ? (
              <p className="text-zinc-500 text-sm py-8 text-center">Your cart is empty. Tap any item to add it.</p>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  {cart.map((line, index) => {
                    const listing = getListingById(line.listingId);
                    if (!listing) return null;
                    const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
                    return (
                      <div key={index} className="flex items-center gap-3 p-2 rounded-xl border border-zinc-200">
                        <img src={displayImage} alt={listing.name} className="w-14 h-14 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{listing.name}</p>
                          {(line.color || line.size) && (<p className="text-xs text-zinc-500">{line.color}{line.color && line.size ? ' · ' : ''}{line.size}</p>)}
                          <p className="text-sm font-mono text-lime-500">{(Number(listing.price) / 1e18).toString()} {currencySymbol(listing.paymentToken)}</p>
                        </div>
                        <button onClick={() => removeFromCart(index)} className="text-red-500 text-xs font-medium shrink-0 px-2">Remove</button>
                      </div>
                    );
                  })}
                </div>
                {checkoutSummary && (
                  <div className="mb-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                    <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><span className="font-mono">{(Number(checkoutSummary.subtotal) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-zinc-500">Buyer fee ({buyerFeePct}%)</span><span className="font-mono">{(Number(checkoutSummary.fee) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                    <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-zinc-200"><span>Total</span><span className="font-mono text-lime-500">{(Number(checkoutSummary.total) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                  </div>
                )}
                <div className="space-y-2">
                  {!isConnected ? (
                    <button onClick={() => { setCartOpen(false); openWalletChoice(); }} className="w-full py-3 bg-zinc-900 text-white rounded-2xl font-medium hover:bg-zinc-800 transition-colors">Login to Checkout</button>
                  ) : (
                    <button onClick={() => { setCartOpen(false); setShippingForm(emptyShipping); setShippingModal(true); }} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">Checkout</button>
                  )}
                  <button onClick={() => { setCart([]); setCartCurrency(null); }} className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-medium transition-colors">Clear Cart</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SHIPPING / CHECKOUT MODAL */}
      {shippingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md border border-zinc-200">
            <h3 className="font-semibold text-lg mb-1">Shipping Details</h3>
            <p className="text-xs text-zinc-500 mb-4">Saved securely so your seller can view it to ship your order.</p>
            <div className="space-y-3 mb-5">
              <input type="text" placeholder="Full Name" value={shippingForm.fullName} onChange={(e) => setShippingForm({ ...shippingForm, fullName: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors" />
              <input type="text" placeholder="Street Address" value={shippingForm.address} onChange={(e) => setShippingForm({ ...shippingForm, address: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors" />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="City" value={shippingForm.city} onChange={(e) => setShippingForm({ ...shippingForm, city: e.target.value })} className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors" />
                <input type="text" placeholder="Country" value={shippingForm.country} onChange={(e) => setShippingForm({ ...shippingForm, country: e.target.value })} className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors" />
              </div>
              <input type="text" placeholder="Phone (optional)" value={shippingForm.phone} onChange={(e) => setShippingForm({ ...shippingForm, phone: e.target.value })} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors" />
            </div>
            {checkoutSummary && (
              <div className="mb-5 p-4 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1.5">
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Subtotal</span><span className="font-mono">{(Number(checkoutSummary.subtotal) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                <div className="flex justify-between text-sm"><span className="text-zinc-500">Buyer fee ({buyerFeePct}%)</span><span className="font-mono">{(Number(checkoutSummary.fee) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-zinc-200"><span>Total</span><span className="font-mono text-lime-500">{(Number(checkoutSummary.total) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
              </div>
            )}
            <div className="space-y-2">
              <button onClick={confirmShippingAndBuy} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">{isPending ? 'Confirm in wallet...' : 'Buy / Pay'}</button>
              <button onClick={() => setShippingModal(false)} className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-medium transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL - same options as the main shop page */}
      {walletChoiceOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-zinc-200 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg mb-1">Connect Your Wallet</h3>
            <p className="text-xs text-zinc-500 mb-4">New here? Pick any option below — a wallet is created for you automatically.</p>
            {oauthErr && (<div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-xs text-red-500 font-medium">{oauthErr}</p></div>)}
            {privyAuthenticated && !isConnected && (<div className="mb-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2"><div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" /><p className="text-xs text-sky-600 font-medium">Setting up your wallet, one moment...</p></div>)}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={handleGoogleLogin} disabled={!privyReady} className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 font-medium text-sm disabled:opacity-50"><span className="w-5 h-5 rounded-full bg-white border border-zinc-300 flex items-center justify-center text-[11px] font-bold text-blue-500">G</span>Google</button>
              <button onClick={handleTwitterLogin} disabled={!privyReady} className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 font-medium text-sm disabled:opacity-50"><span className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-[11px] font-bold text-white">𝕏</span>X</button>
            </div>
            <button onClick={handlePasskeyLogin} disabled={!privyReady} className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border border-zinc-200 hover:bg-zinc-50 font-medium text-sm disabled:opacity-50 mb-3">🔑 Continue with Passkey</button>
            <div className="p-3 rounded-2xl border border-zinc-200 mb-3">
              {emailStep === 'input' ? (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 block">Or continue with email</label>
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="you@example.com" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:border-lime-400 text-sm" />
                  <button onClick={handleSendCode} disabled={emailBusy || !emailInput.trim()} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50">{emailBusy ? 'Sending...' : 'Send Code'}</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-zinc-500 block">Enter the code sent to {emailInput}</label>
                  <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="123456" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 outline-none focus:border-lime-400 text-sm tracking-widest" />
                  <button onClick={handleVerifyCode} disabled={emailBusy || !codeInput.trim()} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50">{emailBusy ? 'Verifying...' : 'Verify & Continue'}</button>
                  <button onClick={resetEmailFlow} className="w-full text-xs text-zinc-500 py-1">Use a different email</button>
                </div>
              )}
              {emailErr && <p className="text-xs text-red-500 mt-2">{emailErr}</p>}
            </div>
            <div className="flex items-center gap-3 mb-3"><div className="flex-1 h-px bg-zinc-200" /><span className="text-xs text-zinc-500">or use your own wallet</span><div className="flex-1 h-px bg-zinc-200" /></div>
            <div className="space-y-2 mb-4">
              <button onClick={() => { connectWallet(); setWalletChoiceOpen(false); }} className="w-full py-3 px-4 rounded-2xl border border-zinc-200 hover:bg-zinc-50 text-left font-medium transition-colors">
                Connect Existing Wallet
                <span className="block text-xs font-normal mt-0.5 text-zinc-500">MetaMask, WalletConnect, Coinbase Wallet, and more</span>
              </button>
            </div>
            <button onClick={() => { setWalletChoiceOpen(false); resetEmailFlow(); setOauthErr(''); }} className="w-full py-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-sm font-medium transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
