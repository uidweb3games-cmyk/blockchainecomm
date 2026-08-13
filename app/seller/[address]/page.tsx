'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useReadContract, useReadContracts } from 'wagmi';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI } from '../../contract';
import { supabase } from '../../supabaseClient';

const FALLBACK_IMAGE = 'https://placehold.co/400x400/e2e8f0/94a3b8?text=No+Image';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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
};

function currencySymbol(tokenAddress: string) {
  if (tokenAddress.toLowerCase() === ZERO_ADDRESS) return 'tBNB';
  return 'TOKEN';
}

export default function SellerStorefrontPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const cameFromOwnDashboard = searchParams.get('from') === 'dashboard';
  const sellerAddress = (Array.isArray(params?.address) ? params.address[0] : params?.address) || '';
  const [profile, setProfile] = useState<{ shopName: string; bio: string } | null>(null);
  const [profileChecked, setProfileChecked] = useState(false);
  const [reviews, setReviews] = useState<{ orderId: number; buyerAddress: string; rating: number; reviewText: string | null; createdAt: string }[]>([]);

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

    supabase.functions
      .invoke('reviews', {
        body: { action: 'getReviews', contractAddress: MARKETPLACE_ADDRESS, sellerAddress },
      })
      .then(({ data, error }) => {
        if (!error && data?.data) {
          setReviews(data.data.map((r: any) => ({ orderId: r.order_id, buyerAddress: r.buyer_address, rating: r.rating, reviewText: r.review_text, createdAt: r.created_at })));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerAddress]);

  const averageRating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  const { data: listingCount } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'listingCount' });
  const lCount = listingCount ? Number(listingCount) : 0;

  const listingContracts = Array.from({ length: lCount }, (_, i) => ({
    address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getListing' as const, args: [BigInt(i + 1)] as const,
  }));
  const { data: listingsData } = useReadContracts({ contracts: listingContracts, query: { enabled: lCount > 0 } });

  const allListings: Listing[] = (() => {
    if (!listingsData) return [];
    return listingsData
      .map((result, index) => {
        if (result.status !== 'success' || !result.result) return null;
        const [name, imageUrl, category, price, seller, paymentToken, delisted, hasVariants] = result.result as [
          string, string, string, bigint, string, string, boolean, boolean
        ];
        return { id: index + 1, name, imageUrl, category, price, seller, paymentToken, delisted, hasVariants };
      })
      .filter((x): x is Listing => x !== null);
  })();

  const sellerListings = allListings.filter(
    (l) => l.seller.toLowerCase() === sellerAddress.toLowerCase() && !l.delisted
  );

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(sellerAddress);

  return (
    <div className="min-h-screen bg-white text-zinc-900 pb-16">
      <header className="border-b border-zinc-200 sticky top-0 bg-white/80 backdrop-blur-xl z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-4">
          {cameFromOwnDashboard ? (
            <Link href="/?tab=sell" className="text-sm font-semibold bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
              ← Back to Seller Dashboard
            </Link>
          ) : (
            <Link href="/" className="text-sm font-semibold bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
              ← Back to OpenSpace
            </Link>
          )}
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
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                    {profile?.shopName || (profileChecked ? 'Seller Storefront' : 'Loading...')}
                  </h1>
                  <p className="text-xs text-zinc-500 font-mono">{sellerAddress.slice(0, 6)}...{sellerAddress.slice(-4)}</p>
                  {averageRating !== null && (
                    <p className="text-sm mt-1 flex items-center gap-1">
                      <span className="text-amber-400">{'★'.repeat(Math.round(averageRating))}{'☆'.repeat(5 - Math.round(averageRating))}</span>
                      <span className="text-zinc-600">{averageRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? '' : 's'})</span>
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
                    <Link
                      key={listing.id}
                      href={`/?item=${listing.id}${cameFromOwnDashboard ? '&tab=sell' : ''}`}
                      className="group text-left bg-white rounded-2xl overflow-hidden border border-zinc-200 hover:border-lime-400/60 transition-all duration-300"
                    >
                      <div className="w-full aspect-square bg-zinc-100 overflow-hidden">
                        <img
                          src={displayImage}
                          alt={listing.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                        />
                      </div>
                      <div className="px-2.5 py-2">
                        <p className="text-sm font-medium truncate">{listing.name}</p>
                        <p className="text-xs font-mono text-lime-600">
                          {(Number(listing.price) / 1e18).toString()} {currencySymbol(listing.paymentToken)}
                        </p>
                      </div>
                    </Link>
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
    </div>
  );
}
