'use client';

import { useEffect, useState, useRef, useId } from 'react';
import Link from 'next/link';
import { useAccount, useDisconnect, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useBalance, useSendTransaction, useSignMessage } from 'wagmi';
import { usePrivy, useLoginWithOAuth, useLoginWithEmail, useLoginWithPasskey, useConnectWallet, useWallets, useCreateWallet } from '@privy-io/react-auth';
import { useSetActiveWallet } from '@privy-io/wagmi';
import { formatEther, parseEther } from 'viem';
import { BarChart, Bar, ResponsiveContainer, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MARKETPLACE_ADDRESS, MARKETPLACE_ABI, USDC_ADDRESS, USDT_ADDRESS, ERC20_ABI } from './contract';
import { supabase } from './supabaseClient';
import nacl from 'tweetnacl';

const SHIPPING_LABELS = ['Processing', 'Shipped', 'Delivered'];
const FALLBACK_IMAGE = 'https://placehold.co/400x400/e2e8f0/94a3b8?text=No+Image';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ALL_KEY = 'ALL';
const ALL_CATEGORIES = 'All Categories';
const BRAND_NAME = 'OpenSpace';
const ONBOARDING_SEEN_KEY = 'openspace_onboarding_seen';
const ACTIVE_TAB_KEY = 'openspace_active_tab';
const DARK_MODE_KEY = 'openspace_dark_mode';
const PURCHASES_OPEN_KEY = 'openspace_purchases_open';
const CART_STORAGE_KEY = 'openspace_cart';
const CART_CURRENCY_STORAGE_KEY = 'openspace_cart_currency';
const NO_VARIANT = '';

const CATEGORIES = ['Electronics', 'Gadget', 'Clothing', 'Shoes', 'Accessories', 'Home & Furniture', 'Kitchen Items', 'Groceries & Essentials', 'Beauty & Health', 'Sports & Outdoors', 'Toys & Games', 'Other'];
const CATEGORY_ICONS: Record<string, string> = {
  'Electronics': '📱', 'Gadget': '⌚', 'Clothing': '👕', 'Shoes': '👟', 'Accessories': '👜',
  'Home & Furniture': '🛋️', 'Kitchen Items': '🍳', 'Groceries & Essentials': '🛒', 'Beauty & Health': '💄', 'Sports & Outdoors': '⚽', 'Toys & Games': '🎮', 'Other': '🏷️',
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

type ShippingInfo = { fullName: string; address: string; city: string; state: string; country: string; phone: string };
const emptyShipping: ShippingInfo = { fullName: '', address: '', city: '', state: '', country: '', phone: '' };

// Countries eligible to ship to. Once compliance is secured for specific
// regions, remove the ineligible entries from this list - the dropdown
// (and the country-code phone list, which reuses it) updates automatically,
// no other code changes needed.
const COUNTRIES: { name: string; code: string; dial: string }[] = [
  { name: "Afghanistan", code: "AF", dial: "+93" },
  { name: "Albania", code: "AL", dial: "+355" },
  { name: "Algeria", code: "DZ", dial: "+213" },
  { name: "Andorra", code: "AD", dial: "+376" },
  { name: "Angola", code: "AO", dial: "+244" },
  { name: "Antigua and Barbuda", code: "AG", dial: "+1268" },
  { name: "Argentina", code: "AR", dial: "+54" },
  { name: "Armenia", code: "AM", dial: "+374" },
  { name: "Australia", code: "AU", dial: "+61" },
  { name: "Austria", code: "AT", dial: "+43" },
  { name: "Azerbaijan", code: "AZ", dial: "+994" },
  { name: "Bahamas", code: "BS", dial: "+1242" },
  { name: "Bahrain", code: "BH", dial: "+973" },
  { name: "Bangladesh", code: "BD", dial: "+880" },
  { name: "Barbados", code: "BB", dial: "+1246" },
  { name: "Belarus", code: "BY", dial: "+375" },
  { name: "Belgium", code: "BE", dial: "+32" },
  { name: "Belize", code: "BZ", dial: "+501" },
  { name: "Benin", code: "BJ", dial: "+229" },
  { name: "Bhutan", code: "BT", dial: "+975" },
  { name: "Bolivia", code: "BO", dial: "+591" },
  { name: "Bosnia and Herzegovina", code: "BA", dial: "+387" },
  { name: "Botswana", code: "BW", dial: "+267" },
  { name: "Brazil", code: "BR", dial: "+55" },
  { name: "Brunei", code: "BN", dial: "+673" },
  { name: "Bulgaria", code: "BG", dial: "+359" },
  { name: "Burkina Faso", code: "BF", dial: "+226" },
  { name: "Burundi", code: "BI", dial: "+257" },
  { name: "Cabo Verde", code: "CV", dial: "+238" },
  { name: "Cambodia", code: "KH", dial: "+855" },
  { name: "Cameroon", code: "CM", dial: "+237" },
  { name: "Canada", code: "CA", dial: "+1" },
  { name: "Central African Republic", code: "CF", dial: "+236" },
  { name: "Chad", code: "TD", dial: "+235" },
  { name: "Chile", code: "CL", dial: "+56" },
  { name: "China", code: "CN", dial: "+86" },
  { name: "Colombia", code: "CO", dial: "+57" },
  { name: "Comoros", code: "KM", dial: "+269" },
  { name: "Congo (DRC)", code: "CD", dial: "+243" },
  { name: "Congo (Republic)", code: "CG", dial: "+242" },
  { name: "Costa Rica", code: "CR", dial: "+506" },
  { name: "Croatia", code: "HR", dial: "+385" },
  { name: "Cuba", code: "CU", dial: "+53" },
  { name: "Cyprus", code: "CY", dial: "+357" },
  { name: "Czechia", code: "CZ", dial: "+420" },
  { name: "Denmark", code: "DK", dial: "+45" },
  { name: "Djibouti", code: "DJ", dial: "+253" },
  { name: "Dominica", code: "DM", dial: "+1767" },
  { name: "Dominican Republic", code: "DO", dial: "+1809" },
  { name: "Ecuador", code: "EC", dial: "+593" },
  { name: "Egypt", code: "EG", dial: "+20" },
  { name: "El Salvador", code: "SV", dial: "+503" },
  { name: "Equatorial Guinea", code: "GQ", dial: "+240" },
  { name: "Eritrea", code: "ER", dial: "+291" },
  { name: "Estonia", code: "EE", dial: "+372" },
  { name: "Eswatini", code: "SZ", dial: "+268" },
  { name: "Ethiopia", code: "ET", dial: "+251" },
  { name: "Fiji", code: "FJ", dial: "+679" },
  { name: "Finland", code: "FI", dial: "+358" },
  { name: "France", code: "FR", dial: "+33" },
  { name: "Gabon", code: "GA", dial: "+241" },
  { name: "Gambia", code: "GM", dial: "+220" },
  { name: "Georgia", code: "GE", dial: "+995" },
  { name: "Germany", code: "DE", dial: "+49" },
  { name: "Ghana", code: "GH", dial: "+233" },
  { name: "Greece", code: "GR", dial: "+30" },
  { name: "Grenada", code: "GD", dial: "+1473" },
  { name: "Guatemala", code: "GT", dial: "+502" },
  { name: "Guinea", code: "GN", dial: "+224" },
  { name: "Guinea-Bissau", code: "GW", dial: "+245" },
  { name: "Guyana", code: "GY", dial: "+592" },
  { name: "Haiti", code: "HT", dial: "+509" },
  { name: "Honduras", code: "HN", dial: "+504" },
  { name: "Hungary", code: "HU", dial: "+36" },
  { name: "Iceland", code: "IS", dial: "+354" },
  { name: "India", code: "IN", dial: "+91" },
  { name: "Indonesia", code: "ID", dial: "+62" },
  { name: "Iran", code: "IR", dial: "+98" },
  { name: "Iraq", code: "IQ", dial: "+964" },
  { name: "Ireland", code: "IE", dial: "+353" },
  { name: "Israel", code: "IL", dial: "+972" },
  { name: "Italy", code: "IT", dial: "+39" },
  { name: "Ivory Coast", code: "CI", dial: "+225" },
  { name: "Jamaica", code: "JM", dial: "+1876" },
  { name: "Japan", code: "JP", dial: "+81" },
  { name: "Jordan", code: "JO", dial: "+962" },
  { name: "Kazakhstan", code: "KZ", dial: "+7" },
  { name: "Kenya", code: "KE", dial: "+254" },
  { name: "Kiribati", code: "KI", dial: "+686" },
  { name: "Kosovo", code: "XK", dial: "+383" },
  { name: "Kuwait", code: "KW", dial: "+965" },
  { name: "Kyrgyzstan", code: "KG", dial: "+996" },
  { name: "Laos", code: "LA", dial: "+856" },
  { name: "Latvia", code: "LV", dial: "+371" },
  { name: "Lebanon", code: "LB", dial: "+961" },
  { name: "Lesotho", code: "LS", dial: "+266" },
  { name: "Liberia", code: "LR", dial: "+231" },
  { name: "Libya", code: "LY", dial: "+218" },
  { name: "Liechtenstein", code: "LI", dial: "+423" },
  { name: "Lithuania", code: "LT", dial: "+370" },
  { name: "Luxembourg", code: "LU", dial: "+352" },
  { name: "Madagascar", code: "MG", dial: "+261" },
  { name: "Malawi", code: "MW", dial: "+265" },
  { name: "Malaysia", code: "MY", dial: "+60" },
  { name: "Maldives", code: "MV", dial: "+960" },
  { name: "Mali", code: "ML", dial: "+223" },
  { name: "Malta", code: "MT", dial: "+356" },
  { name: "Marshall Islands", code: "MH", dial: "+692" },
  { name: "Mauritania", code: "MR", dial: "+222" },
  { name: "Mauritius", code: "MU", dial: "+230" },
  { name: "Mexico", code: "MX", dial: "+52" },
  { name: "Micronesia", code: "FM", dial: "+691" },
  { name: "Moldova", code: "MD", dial: "+373" },
  { name: "Monaco", code: "MC", dial: "+377" },
  { name: "Mongolia", code: "MN", dial: "+976" },
  { name: "Montenegro", code: "ME", dial: "+382" },
  { name: "Morocco", code: "MA", dial: "+212" },
  { name: "Mozambique", code: "MZ", dial: "+258" },
  { name: "Myanmar", code: "MM", dial: "+95" },
  { name: "Namibia", code: "NA", dial: "+264" },
  { name: "Nauru", code: "NR", dial: "+674" },
  { name: "Nepal", code: "NP", dial: "+977" },
  { name: "Netherlands", code: "NL", dial: "+31" },
  { name: "New Zealand", code: "NZ", dial: "+64" },
  { name: "Nicaragua", code: "NI", dial: "+505" },
  { name: "Niger", code: "NE", dial: "+227" },
  { name: "Nigeria", code: "NG", dial: "+234" },
  { name: "North Korea", code: "KP", dial: "+850" },
  { name: "North Macedonia", code: "MK", dial: "+389" },
  { name: "Norway", code: "NO", dial: "+47" },
  { name: "Oman", code: "OM", dial: "+968" },
  { name: "Pakistan", code: "PK", dial: "+92" },
  { name: "Palau", code: "PW", dial: "+680" },
  { name: "Palestine", code: "PS", dial: "+970" },
  { name: "Panama", code: "PA", dial: "+507" },
  { name: "Papua New Guinea", code: "PG", dial: "+675" },
  { name: "Paraguay", code: "PY", dial: "+595" },
  { name: "Peru", code: "PE", dial: "+51" },
  { name: "Philippines", code: "PH", dial: "+63" },
  { name: "Poland", code: "PL", dial: "+48" },
  { name: "Portugal", code: "PT", dial: "+351" },
  { name: "Qatar", code: "QA", dial: "+974" },
  { name: "Romania", code: "RO", dial: "+40" },
  { name: "Russia", code: "RU", dial: "+7" },
  { name: "Rwanda", code: "RW", dial: "+250" },
  { name: "Saint Kitts and Nevis", code: "KN", dial: "+1869" },
  { name: "Saint Lucia", code: "LC", dial: "+1758" },
  { name: "Saint Vincent and the Grenadines", code: "VC", dial: "+1784" },
  { name: "Samoa", code: "WS", dial: "+685" },
  { name: "San Marino", code: "SM", dial: "+378" },
  { name: "Sao Tome and Principe", code: "ST", dial: "+239" },
  { name: "Saudi Arabia", code: "SA", dial: "+966" },
  { name: "Senegal", code: "SN", dial: "+221" },
  { name: "Serbia", code: "RS", dial: "+381" },
  { name: "Seychelles", code: "SC", dial: "+248" },
  { name: "Sierra Leone", code: "SL", dial: "+232" },
  { name: "Singapore", code: "SG", dial: "+65" },
  { name: "Slovakia", code: "SK", dial: "+421" },
  { name: "Slovenia", code: "SI", dial: "+386" },
  { name: "Solomon Islands", code: "SB", dial: "+677" },
  { name: "Somalia", code: "SO", dial: "+252" },
  { name: "South Africa", code: "ZA", dial: "+27" },
  { name: "South Korea", code: "KR", dial: "+82" },
  { name: "South Sudan", code: "SS", dial: "+211" },
  { name: "Spain", code: "ES", dial: "+34" },
  { name: "Sri Lanka", code: "LK", dial: "+94" },
  { name: "Sudan", code: "SD", dial: "+249" },
  { name: "Suriname", code: "SR", dial: "+597" },
  { name: "Sweden", code: "SE", dial: "+46" },
  { name: "Switzerland", code: "CH", dial: "+41" },
  { name: "Syria", code: "SY", dial: "+963" },
  { name: "Taiwan", code: "TW", dial: "+886" },
  { name: "Tajikistan", code: "TJ", dial: "+992" },
  { name: "Tanzania", code: "TZ", dial: "+255" },
  { name: "Thailand", code: "TH", dial: "+66" },
  { name: "Timor-Leste", code: "TL", dial: "+670" },
  { name: "Togo", code: "TG", dial: "+228" },
  { name: "Tonga", code: "TO", dial: "+676" },
  { name: "Trinidad and Tobago", code: "TT", dial: "+1868" },
  { name: "Tunisia", code: "TN", dial: "+216" },
  { name: "Turkey", code: "TR", dial: "+90" },
  { name: "Turkmenistan", code: "TM", dial: "+993" },
  { name: "Tuvalu", code: "TV", dial: "+688" },
  { name: "Uganda", code: "UG", dial: "+256" },
  { name: "Ukraine", code: "UA", dial: "+380" },
  { name: "United Arab Emirates", code: "AE", dial: "+971" },
  { name: "United Kingdom", code: "GB", dial: "+44" },
  { name: "United States", code: "US", dial: "+1" },
  { name: "Uruguay", code: "UY", dial: "+598" },
  { name: "Uzbekistan", code: "UZ", dial: "+998" },
  { name: "Vanuatu", code: "VU", dial: "+678" },
  { name: "Vatican City", code: "VA", dial: "+379" },
  { name: "Venezuela", code: "VE", dial: "+58" },
  { name: "Vietnam", code: "VN", dial: "+84" },
  { name: "Yemen", code: "YE", dial: "+967" },
  { name: "Zambia", code: "ZM", dial: "+260" },
  { name: "Zimbabwe", code: "ZW", dial: "+263" },
];


type ChatMessage = { id: number; fromAddress: string; toAddress: string; text: string; createdAt: string };
type EvidenceItem = { id: number; submittedBy: string; imageUrl: string | null; note: string | null; createdAt: string };

type Listing = {
  id: number; name: string; imageUrl: string; category: string; price: bigint;
  seller: string; paymentToken: string; delisted: boolean; hasVariants: boolean;
  colors: string[]; sizes: string[]; simpleStock: bigint; isFeaturedNow: boolean;
};

type Order = {
  id: number; listingId: number; buyer: string; color: string; size: string;
  released: boolean; cancelled: boolean; disputed: boolean; purchaseTime: bigint; shippingStatus: number;
};

type CartLine = { listingId: number; color: string; size: string };

function currencySymbol(tokenAddress: string) {
  if (tokenAddress.toLowerCase() === ZERO_ADDRESS) return 'tBNB';
  if (tokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()) return 'USDC';
  if (tokenAddress.toLowerCase() === USDT_ADDRESS.toLowerCase()) return 'USDT';
  return 'TOKEN';
}

const CLOUDINARY_CLOUD_NAME = 'qczxrjw2';
const CLOUDINARY_UPLOAD_PRESET = 'openspace_uploads';

// Public half of the VAPID keypair used for browser push notifications -
// safe to expose in client code by design (the private half stays on the
// Supabase Edge Function only). Generated once, reused forever - do not
// regenerate this unless every existing subscriber needs to re-subscribe.
const VAPID_PUBLIC_KEY = 'BN3BH4j9x_wnHlqieaqAE8oCh2uw6BVS-BjvVNsqWWKd3Yv4SzKPJXOcZYy1NUukQpcj9FJgYchByaleBUAv3nc';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function uploadImageToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload failed');
  return data.secure_url as string;
}

// Same idea as the image upload, but hits Cloudinary's video endpoint
// instead - the account/preset already set up for images works for video
// too, since Cloudinary tells them apart by which URL you upload to, not
// by any extra setup.
async function uploadVideoToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!data.secure_url) throw new Error('Upload failed');
  return data.secure_url as string;
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

function TrolleyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3h2l.6 3M5.6 6h16l-1.8 9H8.2L5.6 6Z" strokeWidth="1.8" />
      <path d="M7 9h14.4M8.1 12h12.2" strokeWidth="1" />
      <path d="M10.5 6v9M14 6v9M17.5 6v9" strokeWidth="1" />
      <circle cx="9.5" cy="19.3" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="19.3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OpenSpaceSymbol({ className }: { className?: string }) {
  // Unique per render so the header and footer copies never collide on the
  // same gradient ID - two SVGs sharing one id is invalid and can render
  // unpredictably across browsers.
  const gradId = `osSymGrad-${useId()}`;
  return (
    <svg viewBox="0 0 210 210" width="210" height="210" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a3e635" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {/* Ring - a full circle with a dashed gap cut into it, centered on the
          right side. Using a dash pattern instead of a hand-computed arc
          path avoids the large-arc/sweep-flag math that's easy to get
          subtly wrong and hard to visually debug. */}
      <circle cx="105" cy="105" r="80" fill="none" stroke={`url(#${gradId})`} strokeWidth="34" strokeLinecap="round" strokeDasharray="435.63 67.02" strokeDashoffset="469.14" />
      {/* Shopping trolley, centered inside the ring - net/mesh basket
          (matching the same style used on the app icon and the cart badges
          elsewhere on the site), same gradient as the ring so it reads as
          one connected piece rather than a separate color. */}
      <path d="M 58 76 L 72 76 L 79 102 L 133 102 L 124 124 L 89 124 Z" fill="none" stroke={`url(#${gradId})`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 82.2 109 L 130.1 109 M 85.8 117 L 126.9 117 M 95 102 L 95 124 M 106 102 L 106 124 M 117 102 L 117 124" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round" />
      <circle cx="95" cy="134" r="6.5" fill={`url(#${gradId})`} />
      <circle cx="118" cy="134" r="6.5" fill={`url(#${gradId})`} />
      {/* Motion swoosh beneath the cart, sweeping out past the ring's gap */}
      <path d="M 55 150 Q 100 118 195 100" fill="none" stroke={`url(#${gradId})`} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function OpenSpaceBrand({ imgClassName, textClassName }: { imgClassName?: string; textClassName?: string }) {
  return (
    <div className="flex items-center gap-0.5 sm:gap-1">
      <OpenSpaceSymbol className={imgClassName} />
      <span className={`font-black tracking-tight bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent ${textClassName}`}>OpenSpace</span>
    </div>
  );
}

export default function Ecommerce() {
  const [mounted, setMounted] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'shop' | 'sell' | 'analytics'>('shop');
  const [sellSubTab, setSellSubTab] = useState<'list' | 'fulfill' | 'ads' | 'history'>('list');
  const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<number>>(new Set());
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');

  const [sellPageMenuOpen, setSellPageMenuOpen] = useState(false);
  const [listMode, setListMode] = useState<'simple' | 'variants'>('simple');
  const [itemName, setItemName] = useState('');
  const [itemImage, setItemImage] = useState('');
  const [itemCategory, setItemCategory] = useState(CATEGORIES[0]);
  const [itemPrice, setItemPrice] = useState('');
  const [itemCurrency, setItemCurrency] = useState('BNB');
  const [itemStock, setItemStock] = useState('');
  const [colorsInput, setColorsInput] = useState('');
  const [sizesInput, setSizesInput] = useState('');
  const [stockMatrix, setStockMatrix] = useState<Record<string, string>>({});
  const [colorImagesInput, setColorImagesInput] = useState<Record<string, string>>({});
  const [newListingMedia, setNewListingMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [newListingSpecs, setNewListingSpecs] = useState<{ label: string; value: string }[]>([]);
  const [newListingDescription, setNewListingDescription] = useState('');
  const [pendingListingDetails, setPendingListingDetails] = useState<{ description: string; specs: { label: string; value: string }[]; startListingCount: number } | null>(null);
  const [pendingListingMedia, setPendingListingMedia] = useState<{ media: { url: string; type: string }[]; startListingCount: number } | null>(null);
  const [editListingMedia, setEditListingMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [editListingSpecs, setEditListingSpecs] = useState<{ label: string; value: string }[]>([]);
  const [editListingDescription, setEditListingDescription] = useState('');
  const [editListingDetailsLoaded, setEditListingDetailsLoaded] = useState(false);
  const [savingListingDetails, setSavingListingDetails] = useState(false);
  const [editListingMediaLoaded, setEditListingMediaLoaded] = useState(false);
  const [savingListingMedia, setSavingListingMedia] = useState(false);
  const [editingListingId, setEditingListingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editImage, setEditImage] = useState('');
  const [editCategory, setEditCategory] = useState(CATEGORIES[0]);
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editVariantStock, setEditVariantStock] = useState<Record<string, string>>({});
  const [editColorImages, setEditColorImages] = useState<Record<string, string>>({});
  const [editQueue, setEditQueue] = useState<{ functionName: string; args: any[] }[]>([]);
  const [editQueueTotal, setEditQueueTotal] = useState(0);
  const [editQueueRunning, setEditQueueRunning] = useState(false);
  const [selectedFeaturedIds, setSelectedFeaturedIds] = useState<number[]>([]);
  const [featuredPickerInitialized, setFeaturedPickerInitialized] = useState(false);
  const [adminSettingsOpen, setAdminSettingsOpen] = useState(false);
  const [newListingFee, setNewListingFee] = useState('');
  const [newAdFee, setNewAdFee] = useState('');
  const [newAdDurationDays, setNewAdDurationDays] = useState('');
  const [newPointsPerListing, setNewPointsPerListing] = useState('');
  const [newPointsPerPurchase, setNewPointsPerPurchase] = useState('');
  const [newPointsPerSale, setNewPointsPerSale] = useState('');
  const [newWelcomeBonus, setNewWelcomeBonus] = useState('');
  const [newReferralPoints, setNewReferralPoints] = useState('');
  const [newRefereeBonusPoints, setNewRefereeBonusPoints] = useState('');
  const [modListingId, setModListingId] = useState('');
  const [modReason, setModReason] = useState('');
  const [modFeaturedListingId, setModFeaturedListingId] = useState('');
  const [faucetToAddress, setFaucetToAddress] = useState('');
  const [faucetAmount, setFaucetAmount] = useState('0.05');
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [sellerOnboardOpen, setSellerOnboardOpen] = useState(false);
  const [sellerOnboardStep, setSellerOnboardStep] = useState(1);
  const [sellerOnboardAgreed, setSellerOnboardAgreed] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);
  const [viewCurrency, setViewCurrency] = useState(ALL_KEY);
  const [viewCategory, setViewCategory] = useState(ALL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'price_low' | 'price_high'>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartCurrency, setCartCurrency] = useState<string | null>(null);
  const [shippingModal, setShippingModal] = useState(false);
  const [shippingForm, setShippingForm] = useState<ShippingInfo>(emptyShipping);
  const [shippingDialCode, setShippingDialCode] = useState('+1');
  const [shippingPhoneLocal, setShippingPhoneLocal] = useState('');
  const [pendingTokenBuy, setPendingTokenBuy] = useState<{ lines: CartLine[]; token: string; totalDue: bigint } | null>(null);
  const [disputeCenterOpen, setDisputeCenterOpen] = useState(false);
  const [resolveCenterOpen, setResolveCenterOpen] = useState(false);
  const [resolvingDispute, setResolvingDispute] = useState(false);
  const [disputeQueueTab, setDisputeQueueTab] = useState<'open' | 'resolved'>('open');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [walletChoiceOpen, setWalletChoiceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [purchasesOpen, setPurchasesOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<{ shopName: string; bio: string } | null>(null);
  const [sellerRegOpen, setSellerRegOpen] = useState(false);
  const [shopNameInput, setShopNameInput] = useState('');
  const [shopBioInput, setShopBioInput] = useState('');
  const [quickViewId, setQuickViewId] = useState<number | null>(null);
  const [zoomActive, setZoomActive] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [pickedColor, setPickedColor] = useState('');
  const [pickedSize, setPickedSize] = useState('');
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
  const [walletSetupTimedOut, setWalletSetupTimedOut] = useState(false);
  const [shippingInfoMap, setShippingInfoMap] = useState<Record<number, ShippingInfo>>({});
  const [chatModalOrderId, setChatModalOrderId] = useState<number | null>(null);
  const [chatMessagesMap, setChatMessagesMap] = useState<Record<number, ChatMessage[]>>({});
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatReadAuth, setChatReadAuth] = useState<{ address: string; message: string; signature: string } | null>(null);
  const [evidenceModalOrderId, setEvidenceModalOrderId] = useState<number | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<Record<number, EvidenceItem[]>>({});
  const [reviewModalOrderId, setReviewModalOrderId] = useState<number | null>(null);
  const [reviewRatingItem, setReviewRatingItem] = useState(0);
  const [reviewRatingCommunication, setReviewRatingCommunication] = useState(0);
  const [reviewRatingShipping, setReviewRatingShipping] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [sellerReviewsMap, setSellerReviewsMap] = useState<Record<string, { orderId: number; listingId: number; rating: number; ratingItem: number | null; ratingCommunication: number | null; ratingShipping: number | null; reviewText: string | null; buyerAddress: string; createdAt: string; helpfulCount: number }[]>>({});
  const [helpfulVotedIds, setHelpfulVotedIds] = useState<Set<number>>(new Set());
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceImageUrl, setEvidenceImageUrl] = useState('');
  const [evidenceUploading, setEvidenceUploading] = useState(false);
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [isModeratorState, setIsModeratorState] = useState(false);
  const [siteAnalytics, setSiteAnalytics] = useState<{ visitsByDay: { date: string; count: number }[]; accountsByDay: { date: string; count: number }[]; totalVisits: number; totalAccounts: number } | null>(null);
  const [siteAnalyticsLoading, setSiteAnalyticsLoading] = useState(false);
  const [caseStatusMap, setCaseStatusMap] = useState<Record<number, { claimedBy: string | null; note: string }>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [pendingShippingSave, setPendingShippingSave] = useState<{ info: ShippingInfo; startOrderCount: number; numItems: number; sellerAddresses: string[]; listingNames: string[]; listingIds: number[] } | null>(null);
  // Tracks a single in-flight blockchain action so its notification can fire
  // only once that specific transaction confirms - reused for shipping
  // status updates, cancellations, and disputes, which all share the same
  // global tx-confirmed flag as every other button on the page.
  const [pendingActionNotify, setPendingActionNotify] = useState<{ toAddress: string; title: string; body: string; orderId: number } | null>(null);
  const [awaitingPurchaseTx, setAwaitingPurchaseTx] = useState(false);
  const [notifications, setNotifications] = useState<{ id: number; orderId: number | null; title: string; body: string; seen: boolean; createdAt: string }[]>([]);
  const [notifBellOpen, setNotifBellOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);

  const { ready: privyReady, authenticated: privyAuthenticated, logout: privyLogout, user: privyUser, exportWallet } = usePrivy();
  const loginIdentity = privyUser?.google?.email || privyUser?.email?.address || (privyUser?.twitter?.username ? `@${privyUser.twitter.username}` : null);
  const { initOAuth } = useLoginWithOAuth();
  const { sendCode, loginWithCode } = useLoginWithEmail();
  const { loginWithPasskey } = useLoginWithPasskey();
  const { connectWallet } = useConnectWallet();
  const { createWallet } = useCreateWallet();
  const { wallets: privyWallets, ready: privyWalletsReady } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { address, isConnected } = useAccount();

  const embeddedWallet = privyWallets.find((w) => w.walletClientType === 'privy');
  const hasEmbeddedWallet = !!embeddedWallet;

  useEffect(() => {
    if (privyAuthenticated && privyWalletsReady && privyWallets.length === 0) {
      const attempts = Number(sessionStorage.getItem('openspace_wallet_reload_attempts') || '0');
      if (attempts < 3) {
        const t = setTimeout(() => {
          sessionStorage.setItem('openspace_wallet_reload_attempts', String(attempts + 1));
          window.location.reload();
        }, 3000 + attempts * 2000);
        return () => clearTimeout(t);
      }
    }
    if (privyWallets.length > 0) {
      sessionStorage.removeItem('openspace_wallet_reload_attempts');
    }
  }, [privyAuthenticated, privyWalletsReady, privyWallets.length]);

  useEffect(() => {
    if (privyAuthenticated && !isConnected) {
      const t = setTimeout(() => setWalletSetupTimedOut(true), 15000);
      return () => clearTimeout(t);
    } else {
      setWalletSetupTimedOut(false);
    }
  }, [privyAuthenticated, isConnected]);

  useEffect(() => {
    if (embeddedWallet) {
      setActiveWallet(embeddedWallet).catch((e) => console.error('setActiveWallet failed:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embeddedWallet]);

  useEffect(() => {
    if (!privyReady || !privyAuthenticated || !privyWalletsReady) return;
    if (privyWallets.length > 0) return;
    const alreadyTried = sessionStorage.getItem('openspace_manual_wallet_create_attempted');
    if (alreadyTried) return;
    sessionStorage.setItem('openspace_manual_wallet_create_attempted', 'true');
    createWallet().catch((e: any) => {
      if (!e?.message?.toLowerCase().includes('already has')) console.error('Manual createWallet failed:', e);
    });
  }, [privyReady, privyAuthenticated, privyWalletsReady, privyWallets.length, createWallet]);

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
  const resetEmailFlow = () => { setEmailStep('input'); setEmailInput(''); setCodeInput(''); setEmailErr(''); setEmailBusy(false); };
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

  // A price-based sort only makes sense within one currency - if the person
  // switches back to viewing all currencies mixed together, fall back to
  // Newest rather than silently showing a meaningless price order.
  useEffect(() => {
    if (viewCurrency === ALL_KEY && (sortOrder === 'price_low' || sortOrder === 'price_high')) {
      setSortOrder('newest');
    }
  }, [viewCurrency, sortOrder]);

  useEffect(() => {
    if (!isConnected || !address) return;
    supabase.functions.invoke('site-analytics', {
      body: { action: 'logWalletConnection', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address },
    }).catch(() => {});
  }, [isConnected, address]);

  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem(ONBOARDING_SEEN_KEY);
    if (!seen) { setHelpModalOpen(true); localStorage.setItem(ONBOARDING_SEEN_KEY, 'true'); }
    const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
    if (savedTab === 'shop' || savedTab === 'sell' || savedTab === 'analytics') {
      setActiveTab(savedTab);
    }
    if (localStorage.getItem(PURCHASES_OPEN_KEY) === 'true') {
      setPurchasesOpen(true);
    }

    // Restore whatever was in the cart from a previous visit - shoppers who
    // aren't ready to check out yet shouldn't have to re-find everything
    // just because they closed the tab.
    const savedCartRaw = localStorage.getItem(CART_STORAGE_KEY);
    if (savedCartRaw) {
      try {
        const parsed = JSON.parse(savedCartRaw);
        if (Array.isArray(parsed)) setCart(parsed);
      } catch (e) {}
    }
    const savedCartCurrency = localStorage.getItem(CART_CURRENCY_STORAGE_KEY);
    if (savedCartCurrency) setCartCurrency(savedCartCurrency);

    // Arriving from a seller storefront link (?item=ID) opens that item
    // directly instead of just landing on the generic shop page.
    const urlParams = new URLSearchParams(window.location.search);
    const itemParam = urlParams.get('item');
    if (itemParam && !isNaN(Number(itemParam))) {
      setActiveTab('shop');
      setQuickViewId(Number(itemParam));
    }
    if (urlParams.get('tab') === 'sell') {
      setActiveTab('sell');
    }
    // These URL instructions are meant to fire once, on arrival - clean the
    // address bar right after reading them so a later refresh lands on a
    // plain page instead of endlessly reopening the same item/tab.
    if (itemParam || urlParams.get('tab')) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    // One anonymous visit logged per browser tab session - not tied to a
    // wallet, works even for someone who never connects at all.
    if (!sessionStorage.getItem('openspace_visit_logged')) {
      sessionStorage.setItem('openspace_visit_logged', 'true');
      supabase.functions.invoke('site-analytics', {
        body: { action: 'logVisit', contractAddress: MARKETPLACE_ADDRESS },
      }).catch(() => {});
    }
    if (localStorage.getItem(DARK_MODE_KEY) === 'true') {
      setDarkMode(true);
    }
  }, []);

  // Remember dark/light mode too, same reasoning as the tab.
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(DARK_MODE_KEY, darkMode ? 'true' : 'false');
  }, [darkMode, mounted]);

  // Remember whichever tab (Buy / Sell / Analytics) the person is on, so a
  // page refresh keeps them there instead of always resetting to the shop.
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(ACTIVE_TAB_KEY, activeTab);
  }, [activeTab, mounted]);

  // Same idea for the My Purchases view specifically, since it's a common
  // place people refresh from while tracking a shipment.
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(PURCHASES_OPEN_KEY, purchasesOpen ? 'true' : 'false');
  }, [purchasesOpen, mounted]);

  // Persist the cart itself so closing the tab/site never silently empties
  // it - only an explicit "Clear Cart" or completing checkout should do that.
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    if (cartCurrency) {
      localStorage.setItem(CART_CURRENCY_STORAGE_KEY, cartCurrency);
    } else {
      localStorage.removeItem(CART_CURRENCY_STORAGE_KEY);
    }
  }, [cart, cartCurrency, mounted]);

  const { disconnect } = useDisconnect();
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const { data: myBnbBalance } = useBalance({ address, query: { enabled: !!address } });
  const { data: myUsdcBalance } = useReadContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: myUsdtBalance } = useReadContract({ address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: address ? [address] : undefined, query: { enabled: !!address } });

  // Seller shop profile (shop name + bio) now lives in Supabase instead of
  // localStorage, so it's visible from any device - not just the seller's
  // own browser. Public to read, signature-verified to save.
  useEffect(() => {
    if (!address) { setSellerProfile(null); return; }
    supabase.functions.invoke('seller-profiles', {
      body: { action: 'getProfile', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address },
    }).then(({ data, error }) => {
      if (error) { console.error('Failed to load seller profile:', error); return; }
      const row = data?.data;
      setSellerProfile(row ? { shopName: row.shop_name, bio: row.bio || '' } : null);
    });
  }, [address]);

  const saveSellerProfile = async () => {
    if (!address || !shopNameInput.trim()) { alert('Please enter a shop name'); return; }
    const auth = await ensureChatSessionAuth();
    if (!auth) return;
    const { error } = await supabase.functions.invoke('seller-profiles', {
      body: { action: 'saveProfile', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address, shopName: shopNameInput.trim(), bio: shopBioInput.trim(), message: auth.message, signature: auth.signature },
    });
    if (error) { console.error('Failed to save seller profile:', error); alert('Failed to save shop profile. Please try again.'); return; }
    const profile = { shopName: shopNameInput.trim(), bio: shopBioInput.trim() };
    setSellerProfile(profile);
    setSellerRegOpen(false);
    setSellerOnboardOpen(false);
    setSellerOnboardStep(1);
    setSellerOnboardAgreed(false);
  };
  const openSellerReg = () => { setShopNameInput(sellerProfile?.shopName ?? ''); setShopBioInput(sellerProfile?.bio ?? ''); setSellerRegOpen(true); };
  const openWalletChoice = () => { resetEmailFlow(); setOauthErr(''); setWalletChoiceOpen(true); };

  const handleDisconnect = async () => {
    try { await privyLogout(); } catch (e) {}
    disconnect();
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('privy') || key.startsWith('wagmi') || key.startsWith('@appkit') || key.startsWith('wc@2') || key.startsWith('base-acc-sdk')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {}
    window.location.href = '/';
  };

  const copyAddress = () => { if (address) { navigator.clipboard.writeText(address); setAddressCopied(true); setTimeout(() => setAddressCopied(false), 2000); } };
  const copySettingsAddress = () => { if (address) { navigator.clipboard.writeText(address); setSettingsAddressCopied(true); setTimeout(() => setSettingsAddressCopied(false), 2000); } };

  // ---------- CONTRACT READS ----------
  const { data: listingCount, refetch: refetchListingCount } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'listingCount' });
  const { data: orderCount, refetch: refetchOrderCount } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'orderCount' });
  const { data: adminAddress } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'admin' });
  const { data: feeWalletAddress } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'feeWallet' });
  const { data: sellerFeePercent } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'sellerFeePercent' });
  const { data: buyerFeePercent } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'buyerFeePercent' });
  const { data: listingFeeData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'listingFee' });
  const listingFeeWei = listingFeeData ?? BigInt(0);
  const { data: releaseWindowData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'releaseWindow' });
  const releaseWindow = releaseWindowData;
  const { data: adSubscriptionFeeData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'adSubscriptionFee' });
  const adSubscriptionFeeWei = adSubscriptionFeeData ?? BigInt(0);
  const { data: adSubscriptionDurationData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'adSubscriptionDuration' });
  const adSubscriptionDurationSeconds = adSubscriptionDurationData ? Number(adSubscriptionDurationData) : 0;
  const { data: mySubscriptionExpiryData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'adSubscriptionExpiry', args: address ? [address] : undefined, query: { enabled: !!address } });
  const mySubscriptionExpiry = mySubscriptionExpiryData ? Number(mySubscriptionExpiryData) : 0;
  const mySubscriptionActive = mySubscriptionExpiry * 1000 > Date.now();
  const { data: myFeaturedListingsData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getSellerFeaturedListings', args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: myPointsData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'points', args: address ? [address] : undefined, query: { enabled: !!address } });
  const myPoints = myPointsData ? Number(myPointsData) : 0;
  const { data: hasClaimedWelcomeData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'hasClaimedWelcomeBonus', args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: myReferrerData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'referrerOf', args: address ? [address] : undefined, query: { enabled: !!address } });
  const { data: referralPointsData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'referralPoints' });
  const { data: refereeBonusPointsData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'refereeBonusPoints' });
  const hasClaimedWelcome = Boolean(hasClaimedWelcomeData);
  const { data: pointsPerListingData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'pointsPerListing' });
  const { data: pointsPerPurchaseData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'pointsPerPurchase' });
  const { data: pointsPerSaleData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'pointsPerSale' });
  const { data: welcomeBonusPointsData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'welcomeBonusPoints' });
  const { data: pointsSystemActiveData } = useReadContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'pointsSystemActive' });
  const pointsSystemActiveNow = pointsSystemActiveData === undefined ? true : Boolean(pointsSystemActiveData);

  const lCount = listingCount ? Number(listingCount) : 0;
  const oCount = orderCount ? Number(orderCount) : 0;
  const buyerFeePct = buyerFeePercent ? Number(buyerFeePercent) : 0;

  const listingContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getListing' as const, args: [BigInt(i + 1)] as const }));
  const variantContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getListingVariants' as const, args: [BigInt(i + 1)] as const }));
  const stockContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getAvailableStock' as const, args: [BigInt(i + 1), NO_VARIANT, NO_VARIANT] as const }));
  const featuredFlagContracts = Array.from({ length: lCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'isFeatured' as const, args: [BigInt(i + 1)] as const }));
  const orderContracts = Array.from({ length: oCount }, (_, i) => ({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getOrder' as const, args: [BigInt(i + 1)] as const }));

  const { data: listingsData, refetch: refetchListings } = useReadContracts({ contracts: listingContracts, query: { enabled: lCount > 0 } });
  const { data: variantsData } = useReadContracts({ contracts: variantContracts, query: { enabled: lCount > 0 } });
  const { data: stockData, refetch: refetchStock } = useReadContracts({ contracts: stockContracts, query: { enabled: lCount > 0 } });
  const { data: featuredFlagData } = useReadContracts({ contracts: featuredFlagContracts, query: { enabled: lCount > 0 } });
  const { data: ordersData, refetch: refetchOrders } = useReadContracts({ contracts: orderContracts, query: { enabled: oCount > 0 } });

  const isAdmin = address && adminAddress && address.toLowerCase() === (adminAddress as string).toLowerCase();

  const { data: feeWalletBnbBalance } = useBalance({ address: feeWalletAddress as `0x${string}` | undefined, query: { enabled: !!feeWalletAddress } });
  const { data: feeWalletUsdcBalance } = useReadContract({ address: USDC_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: feeWalletAddress ? [feeWalletAddress as `0x${string}`] : undefined, query: { enabled: !!feeWalletAddress } });
  const { data: feeWalletUsdtBalance } = useReadContract({ address: USDT_ADDRESS, abi: ERC20_ABI, functionName: 'balanceOf', args: feeWalletAddress ? [feeWalletAddress as `0x${string}`] : undefined, query: { enabled: !!feeWalletAddress } });

  // BNB Smart Chain enforces a network-wide minimum gas price (currently 0.1 Gwei
  // on the version this testnet is running). MetaMask has a known bug on BSC-type
  // chains where, if a site doesn't explicitly specify a gas price, it sometimes
  // guesses a price far below that minimum - causing the transaction to be
  // rejected before it's even sent. Explicitly setting a fixed, safe gas price
  // here (well above the minimum, and effectively free on testnet) means
  // MetaMask never gets a chance to guess wrong.
  const SAFE_GAS_PRICE = BigInt(3000000000); // 3 Gwei

  const call = (functionName: string, args: any[], value?: bigint) => {
    writeContract({ address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: functionName as any, args: args as any, gasPrice: SAFE_GAS_PRICE, ...(value ? { value } : {}) } as any);
  };

  // Admin tool: send plain tBNB directly to a tester's wallet, from this site's own
  // code. Because it explicitly sets the same safe gas price used everywhere else
  // in the app, it sidesteps MetaMask's unreliable automatic gas guessing entirely -
  // unlike a manual send from inside MetaMask itself, or relying on third-party
  // faucets that may be slow, down, or require a mainnet balance.
  const { sendTransaction, isPending: isFaucetPending } = useSendTransaction();
  const handleSendTestBnb = () => {
    if (!faucetToAddress.trim() || !faucetToAddress.trim().startsWith('0x') || faucetToAddress.trim().length !== 42) {
      alert('Please enter a valid wallet address (starts with 0x, 42 characters)'); return;
    }
    if (!faucetAmount || Number(faucetAmount) <= 0) { alert('Please enter a valid amount'); return; }
    sendTransaction({ to: faucetToAddress.trim() as `0x${string}`, value: parseEther(faucetAmount), gasPrice: SAFE_GAS_PRICE });
  };

  const withBuyerFee = (price: bigint): bigint => price + (price * BigInt(buyerFeePct)) / BigInt(100);

  const handleImageFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (url: string) => void,
    key: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKey(key);
    try {
      const url = await uploadImageToCloudinary(file);
      setter(url);
    } catch (err) {
      alert('Image upload failed. Please try again.');
    }
    setUploadingKey(null);
    e.target.value = '';
  };

  const allListings: Listing[] = (() => {
    if (!listingsData || !variantsData || !stockData) return [];
    return listingsData.map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;
      const [name, imageUrl, category, price, seller, paymentToken, delisted, hasVariants] = result.result as [string, string, string, bigint, string, string, boolean, boolean];
      const variantResult = variantsData[index];
      const [colors, sizes] = variantResult.status === 'success' && variantResult.result ? (variantResult.result as [string[], string[]]) : [[], []];
      const stockResult = stockData[index];
      const simpleStock = stockResult.status === 'success' && stockResult.result !== undefined ? (stockResult.result as bigint) : BigInt(0);
      const featuredResult = featuredFlagData ? featuredFlagData[index] : undefined;
      const isFeaturedNow = featuredResult && featuredResult.status === 'success' ? Boolean(featuredResult.result) : false;
      return { id: index + 1, name, imageUrl, category, price, seller, paymentToken, delisted, hasVariants, colors, sizes, simpleStock, isFeaturedNow };
    }).filter((x): x is Listing => x !== null);
  })();

  const allOrders: Order[] = (() => {
    if (!ordersData) return [];
    return ordersData.map((result, index) => {
      if (result.status !== 'success' || !result.result) return null;
      const [listingId, buyer, color, size, released, cancelled, disputed, purchaseTime, shippingStatus] = result.result as [bigint, string, string, string, boolean, boolean, boolean, bigint, number];
      return { id: index + 1, listingId: Number(listingId), buyer, color, size, released, cancelled, disputed, purchaseTime, shippingStatus };
    }).filter((x): x is Order => x !== null);
  })();

  const getListingById = (id: number) => allListings.find((l) => l.id === id);


  // For the "Verified Seller" badge - checks which sellers currently shown
  // in the shop have completed their shop profile setup. Public lookup, no
  // signature needed.
  const [verifiedSellers, setVerifiedSellers] = useState<Set<string>>(new Set());
  const distinctSellerAddresses = Array.from(new Set(allListings.filter((l) => !l.delisted).map((l) => l.seller.toLowerCase())));
  useEffect(() => {
    if (distinctSellerAddresses.length === 0) return;
    supabase.functions.invoke('seller-profiles', {
      body: { action: 'getVerifiedSellers', contractAddress: MARKETPLACE_ADDRESS, walletAddresses: distinctSellerAddresses },
    }).then(({ data, error }) => {
      if (error) { console.error('Failed to load verified sellers:', error); return; }
      setVerifiedSellers(new Set((data?.data || []).map((a: string) => a.toLowerCase())));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distinctSellerAddresses.join(',')]);

  // Fetches whether each resolved dispute ended with the seller getting paid
  // or the buyer getting refunded - only needed for orders that were both
  // disputed AND released.
  const resolvedDisputedOrderIds = allOrders.filter((o) => o.disputed && o.released).map((o) => o.id);
  const disputeOutcomeContracts = resolvedDisputedOrderIds.flatMap((id) => [
    { address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'disputeOutcomeRecorded' as const, args: [BigInt(id)] as const },
    { address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'disputePaidToSeller' as const, args: [BigInt(id)] as const },
  ]);
  const { data: disputeOutcomeData } = useReadContracts({ contracts: disputeOutcomeContracts, query: { enabled: disputeOutcomeContracts.length > 0 } });

  const getDisputeOutcome = (orderId: number): { recorded: boolean; paidToSeller: boolean } | null => {
    const idx = resolvedDisputedOrderIds.indexOf(orderId);
    if (idx === -1 || !disputeOutcomeData) return null;
    const recordedResult = disputeOutcomeData[idx * 2];
    const paidResult = disputeOutcomeData[idx * 2 + 1];
    if (recordedResult?.status !== 'success' || paidResult?.status !== 'success') return null;
    return { recorded: Boolean(recordedResult.result), paidToSeller: Boolean(paidResult.result) };
  };

  // ---------- SHIPPING INFO (Supabase, signature-gated) ----------
  // Shipping data is no longer readable/writable directly from the browser.
  // Every request must include a wallet signature that the Edge Function
  // verifies server-side before touching the database - so a stranger can't
  // read someone else's address, or write fake data into someone's order.
  const { signMessageAsync } = useSignMessage();
  const [sellerShipAuth, setSellerShipAuth] = useState<{ address: string; message: string; signature: string } | null>(null);
  const [unlockingShipInfo, setUnlockingShipInfo] = useState(false);

  const myOrdersToFulfillIds = address
    ? allOrders.filter((o) => {
        const listing = getListingById(o.listingId);
        return listing && listing.seller.toLowerCase() === address.toLowerCase();
      }).map((o) => o.id)
    : [];

  const fetchSellerShippingInfo = async (auth: { address: string; message: string; signature: string }, orderIds: number[]) => {
    const idsNeeded = orderIds.filter((id) => shippingInfoMap[id] === undefined);
    if (idsNeeded.length === 0) return;
    const { data, error } = await supabase.functions.invoke('shipping-info', {
      body: {
        action: 'get',
        contractAddress: MARKETPLACE_ADDRESS,
        sellerAddress: auth.address,
        orderIds: idsNeeded,
        message: auth.message,
        signature: auth.signature,
      },
    });
    if (error) { console.error('Failed to load shipping info:', error); return; }
    const rows = data?.data;
    if (!rows || rows.length === 0) return;
    setShippingInfoMap((prev) => {
      const next = { ...prev };
      rows.forEach((row: any) => {
        next[row.order_id] = {
          fullName: row.full_name,
          address: row.street_address,
          city: row.city || '',
          state: row.state || '',
          country: row.country || '',
          phone: row.phone || '',
        };
      });
      return next;
    });
  };

  const unlockSellerShipping = async () => {
    if (!address) return;
    setUnlockingShipInfo(true);
    try {
      const message = `OpenSpace shipping unlock | contract:${MARKETPLACE_ADDRESS.toLowerCase()} | seller:${address.toLowerCase()}`;
      const signature = await signMessageAsync({ message });
      const auth = { address, message, signature };
      setSellerShipAuth(auth);
      await fetchSellerShippingInfo(auth, myOrdersToFulfillIds);
    } catch (e) {
      console.error('Shipping unlock failed or was rejected:', e);
    }
    setUnlockingShipInfo(false);
  };

  // If the seller already unlocked this session and new orders show up, fetch
  // those too without asking them to sign again.
  useEffect(() => {
    if (!sellerShipAuth || !address || sellerShipAuth.address.toLowerCase() !== address.toLowerCase()) return;
    if (myOrdersToFulfillIds.length === 0) return;
    fetchSellerShippingInfo(sellerShipAuth, myOrdersToFulfillIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerShipAuth, myOrdersToFulfillIds.join(',')]);

  useEffect(() => {
    setSellerShipAuth(null);
  }, [address]);

  // Which sold/history orders a seller has chosen to hide from their own
  // view - purely a personal display preference, kept in localStorage per
  // wallet rather than on-chain or in Supabase, since it doesn't need to
  // sync across devices or be seen by anyone else.
  useEffect(() => {
    if (!address) { setHiddenOrderIds(new Set()); return; }
    const raw = localStorage.getItem(`openspace_hidden_orders_${address.toLowerCase()}`);
    if (raw) { try { setHiddenOrderIds(new Set(JSON.parse(raw))); } catch (e) {} }
    else setHiddenOrderIds(new Set());
  }, [address]);

  const hideOrderFromHistory = (orderId: number) => {
    if (!address) return;
    setHiddenOrderIds((prev) => {
      const next = new Set(prev);
      next.add(orderId);
      localStorage.setItem(`openspace_hidden_orders_${address.toLowerCase()}`, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const unhideAllOrders = () => {
    if (!address) return;
    setHiddenOrderIds(new Set());
    localStorage.setItem(`openspace_hidden_orders_${address.toLowerCase()}`, JSON.stringify([]));
  };

  const saveShippingInfoForOrders = async (orderIds: number[], info: ShippingInfo, sellerAddresses: Record<number, string>) => {
    if (!address || orderIds.length === 0) return;
    try {
      const message = `OpenSpace shipping save | contract:${MARKETPLACE_ADDRESS.toLowerCase()} | orders:${orderIds.join(',')} | buyer:${address.toLowerCase()}`;
      const signature = await signMessageAsync({ message });
      const { error } = await supabase.functions.invoke('shipping-info', {
        body: {
          action: 'save',
          contractAddress: MARKETPLACE_ADDRESS,
          buyerAddress: address,
          orderIds,
          sellerAddresses,
          info,
          message,
          signature,
        },
      });
      if (error) { console.error('Failed to save shipping info:', error); return; }
      setShippingInfoMap((prev) => {
        const next = { ...prev };
        orderIds.forEach((id) => { next[id] = info; });
        return next;
      });
    } catch (e) {
      console.error('Shipping save failed or was rejected:', e);
    }
  };

  // Once the actual purchase transaction (buyMultiple) confirms, figure out which
  // order IDs were just created (orders are created sequentially, one per cart line,
  // so they're the IDs right after the previous order count) and save the shipping
  // info against those specific order IDs.
  useEffect(() => {
    if (!(txConfirmed && awaitingPurchaseTx && pendingShippingSave)) return;
    (async () => {
      const result = await refetchOrderCount();
      const newCount = result.data ? Number(result.data) : oCount;
      const { startOrderCount, numItems, info, sellerAddresses, listingNames, listingIds } = pendingShippingSave;
      const newOrderIds = Array.from({ length: numItems }, (_, i) => startOrderCount + i + 1).filter((id) => id <= newCount);
      const sellerMap: Record<number, string> = {};
      newOrderIds.forEach((id, i) => { if (sellerAddresses[i]) sellerMap[id] = sellerAddresses[i]; });
      await saveShippingInfoForOrders(newOrderIds, info, sellerMap);
      // Notify each seller involved - a multi-item cart can span several
      // sellers at once, so each one gets their own notification for their
      // own item(s), not a single combined alert.
      newOrderIds.forEach((id, i) => {
        if (sellerAddresses[i]) notifySeller(sellerAddresses[i], id, listingNames[i] || 'an item');
      });
      // Low-stock check happens right here, once, tied to this specific
      // purchase - not as a background watcher. This is deliberate: a
      // watcher that polls stock levels can flag the same dip more than
      // once if a read is briefly stale. Checking exactly once, exactly
      // when a real sale happens, means one notification per sale that
      // actually pushes an item low, and nothing in between.
      const freshStock = await refetchStock();
      listingIds.forEach((listingId, i) => {
        const listing = getListingById(listingId);
        if (!listing || listing.hasVariants) return; // variant stock isn't tracked here yet
        const stockResult = freshStock.data?.[listingId - 1];
        const newStock = stockResult && stockResult.status === 'success' && stockResult.result !== undefined ? Number(stockResult.result) : null;
        if (newStock !== null && newStock > 0 && newStock <= 3 && sellerAddresses[i]) {
          sendNotification(sellerAddresses[i], '📦 Low stock', `"${listingNames[i] || listing.name}" is down to ${newStock} left in stock.`);
        }
      });
      setPendingShippingSave(null);
      setAwaitingPurchaseTx(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, awaitingPurchaseTx]);

  // Once a dispute resolution (Pay Seller / Refund Buyer) actually confirms
  // on-chain, close the Dispute Queue automatically instead of leaving the
  // person sitting on a case that's already been settled.
  useEffect(() => {
    if (txConfirmed && resolvingDispute) {
      setResolvingDispute(false);
      setResolveCenterOpen(false);
    }
  }, [txConfirmed, resolvingDispute]);

  // Fires a queued notification once its specific transaction confirms -
  // see pendingActionNotify above for why this indirection is needed.
  useEffect(() => {
    if (!(txConfirmed && pendingActionNotify)) return;
    sendNotification(pendingActionNotify.toAddress, pendingActionNotify.title, pendingActionNotify.body, pendingActionNotify.orderId);
    setPendingActionNotify(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, pendingActionNotify]);

  // Once a new listing's on-chain transaction confirms, we finally know its
  // real listing ID (the count right after it was created) - only then can
  // the extra photos/video be saved against that ID. Reuses the same
  // cached "session" signature already used for chat/reviews/evidence -
  // so this asks for a brand new signature only the very first time a
  // wallet ever uses ANY of these features, never again after that.
  useEffect(() => {
    if (!(txConfirmed && pendingListingMedia && address)) return;
    (async () => {
      // Same real fix as the fresh-count check above: read the actual
      // on-chain counter, not the app's cached listing array (whose
      // length never grows past what it already knew about).
      const result = await refetchListingCount();
      const newCount = result.data !== undefined ? Number(result.data) : lCount;
      const newListingId = pendingListingMedia.startListingCount + 1;
      if (newListingId > newCount) { setPendingListingMedia(null); return; }
      try {
        const auth = await ensureChatSessionAuth();
        if (!auth) { setPendingListingMedia(null); return; }
        await supabase.functions.invoke('listing-media', {
          body: { action: 'save', contractAddress: MARKETPLACE_ADDRESS, listingId: newListingId, sellerAddress: address, media: pendingListingMedia.media, message: auth.message, signature: auth.signature },
        });
      } catch (e) {
        console.error('Failed to save listing media:', e);
      }
      setPendingListingMedia(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, pendingListingMedia, address]);

  // Same idea as the effect above, for Specifications + Description
  // instead of photos/video - a separate off-chain save that also only
  // needs the one shared cached signature, never a fresh one.
  useEffect(() => {
    if (!(txConfirmed && pendingListingDetails && address)) return;
    (async () => {
      // Same real fix as the fresh-count check above: read the actual
      // on-chain counter, not the app's cached listing array (whose
      // length never grows past what it already knew about).
      const result = await refetchListingCount();
      const newCount = result.data !== undefined ? Number(result.data) : lCount;
      const newListingId = pendingListingDetails.startListingCount + 1;
      if (newListingId > newCount) { setPendingListingDetails(null); return; }
      try {
        const auth = await ensureChatSessionAuth();
        if (!auth) { setPendingListingDetails(null); return; }
        await supabase.functions.invoke('listing-details', {
          body: { action: 'save', contractAddress: MARKETPLACE_ADDRESS, listingId: newListingId, sellerAddress: address, description: pendingListingDetails.description, specs: pendingListingDetails.specs, message: auth.message, signature: auth.signature },
        });
      } catch (e) {
        console.error('Failed to save listing details:', e);
      }
      setPendingListingDetails(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, pendingListingDetails, address]);

  // Runs the edit-listing queue one transaction at a time: fires the next
  // queued call only after the previous one actually confirms on-chain,
  // instead of firing every change at once and losing track of all but the
  // last signature. Only closes the modal once every queued change is done.
  useEffect(() => {
    if (!(txConfirmed && editQueueRunning)) return;
    setEditQueue((prev) => {
      const remaining = prev.slice(1);
      if (remaining.length > 0) {
        const next = remaining[0];
        call(next.functionName, next.args);
        return remaining;
      }
      setEditQueueRunning(false);
      setEditQueueTotal(0);
      setEditingListingId(null);
      return [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txConfirmed, editQueueRunning]);

  // Whenever ANY transaction confirms - releasing funds, cancelling,
  // resolving a dispute, delisting, editing stock, updating shipping status,
  // subscribing to ads, and so on - the on-chain data has genuinely changed,
  // but the app's cached copy of it doesn't know that on its own. This
  // re-reads everything relevant so the screen updates itself immediately,
  // instead of quietly showing stale info until someone refreshes manually.
  const txConfirmedRef = useRef(false);
  useEffect(() => {
    if (txConfirmed && !txConfirmedRef.current) {
      txConfirmedRef.current = true;
      refetchOrders();
      refetchListings();
      refetchStock();
    } else if (!txConfirmed) {
      txConfirmedRef.current = false;
    }
  }, [txConfirmed, refetchOrders, refetchListings, refetchStock]);

  // ---------- ENCRYPTED CHAT + DISPUTE EVIDENCE ----------
  // Chat messages are scrambled in the browser before they're ever sent
  // anywhere, using a key derived from a signed message - so only the
  // buyer and seller on an order can ever read their own conversation, not
  // even us. Dispute evidence works differently on purpose: it's NOT
  // encrypted, since it's meant to be reviewed by admin/moderators once a
  // dispute is actually raised.
  //
  // ONE signed "session" message covers everything below - setting up your
  // key, reading, sending, and evidence - reused for the rest of the visit
  // instead of asking for a fresh signature every single step.
  const chatKeyPairRef = useRef<{ publicKey: Uint8Array; secretKey: Uint8Array; address: string } | null>(null);
  const chatKeyRegisteredRef = useRef<string | null>(null);

  function hexToBytesLocal(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    return bytes;
  }
  function bytesToHexLocal(bytes: Uint8Array): string {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const ensureChatSessionAuth = async (): Promise<{ address: string; message: string; signature: string } | null> => {
    if (!address) return null;
    if (chatReadAuth && chatReadAuth.address.toLowerCase() === address.toLowerCase()) return chatReadAuth;

    // Check for a previously-signed session first, so a page refresh never
    // needs to ask for a new signature - only the very first time ever, on
    // this browser, for this wallet.
    const cacheKey = `openspace_chat_session_${address.toLowerCase()}`;
    const sessionMessage = `OpenSpace chat session | contract:${MARKETPLACE_ADDRESS.toLowerCase()} | wallet:${address.toLowerCase()}`;
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw);
        if (cached.message === sessionMessage && cached.signature) {
          const auth = { address, message: cached.message, signature: cached.signature };
          setChatReadAuth(auth);
          return auth;
        }
      } catch (e) {}
    }

    const sessionSignature = await signMessageAsync({ message: sessionMessage });
    const auth = { address, message: sessionMessage, signature: sessionSignature };
    setChatReadAuth(auth);
    localStorage.setItem(cacheKey, JSON.stringify({ message: sessionMessage, signature: sessionSignature }));
    return auth;
  };

  const ensureChatKeyPair = async (): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array } | null> => {
    if (!address) return null;
    if (chatKeyPairRef.current && chatKeyPairRef.current.address.toLowerCase() === address.toLowerCase()) {
      return chatKeyPairRef.current;
    }
    const auth = await ensureChatSessionAuth();
    if (!auth) return null;

    // The seed comes from hashing the session signature itself, so the same
    // key is derived deterministically every time without a separate
    // signature just for key derivation.
    const sigBytes = hexToBytesLocal(auth.signature);
    const hashBuffer = await crypto.subtle.digest('SHA-256', sigBytes as BufferSource);
    const seed = new Uint8Array(hashBuffer);
    const kp = nacl.box.keyPair.fromSecretKey(seed);
    chatKeyPairRef.current = { publicKey: kp.publicKey, secretKey: kp.secretKey, address };

    const myPubHex = bytesToHexLocal(kp.publicKey);
    if (chatKeyRegisteredRef.current !== myPubHex) {
      const { data: existing } = await supabase.functions.invoke('dispute-chat', {
        body: { action: 'getKeys', addresses: [address] },
      });
      const alreadyMatches = existing?.data?.[0]?.public_key === myPubHex;
      if (!alreadyMatches) {
        const { error: regError } = await supabase.functions.invoke('dispute-chat', {
          body: { action: 'registerKey', walletAddress: address, contractAddress: MARKETPLACE_ADDRESS, publicKey: myPubHex, message: auth.message, signature: auth.signature },
        });
        // Only remember this as "done" if it actually succeeded - otherwise
        // we'd silently never retry, and nobody could ever message this
        // person even though everything looked fine on their end.
        if (regError) { console.error('Failed to register chat key:', regError); return { publicKey: kp.publicKey, secretKey: kp.secretKey }; }
      }
      chatKeyRegisteredRef.current = myPubHex;
    }
    return { publicKey: kp.publicKey, secretKey: kp.secretKey };
  };

  const fetchTheirPublicKey = async (theirAddress: string): Promise<Uint8Array | null> => {
    const { data } = await supabase.functions.invoke('dispute-chat', {
      body: { action: 'getKeys', addresses: [theirAddress] },
    });
    const hex = data?.data?.[0]?.public_key;
    return hex ? hexToBytesLocal(hex) : null;
  };

  const loadChatMessages = async (orderId: number, silent = false) => {
    if (!address) return;
    if (!silent) setChatLoading(true);
    try {
      const myKeys = await ensureChatKeyPair();
      const auth = await ensureChatSessionAuth();
      if (!myKeys || !auth) return;
      const { data, error } = await supabase.functions.invoke('dispute-chat', {
        body: { action: 'getMessages', contractAddress: MARKETPLACE_ADDRESS, orderId, walletAddress: address, message: auth.message, signature: auth.signature },
      });
      if (error) { console.error('Failed to load chat:', error); return; }
      const rows = data?.data || [];
      const decrypted: ChatMessage[] = [];
      for (const row of rows) {
        const otherAddress = row.from_address.toLowerCase() === address.toLowerCase() ? row.to_address : row.from_address;
        const theirPub = await fetchTheirPublicKey(otherAddress);
        if (!theirPub) continue;
        const nonceBytes = hexToBytesLocal(row.nonce);
        const cipherBytes = hexToBytesLocal(row.ciphertext);
        const opened = nacl.box.open(cipherBytes, nonceBytes, theirPub, myKeys.secretKey);
        if (!opened) continue;
        decrypted.push({
          id: row.id,
          fromAddress: row.from_address,
          toAddress: row.to_address,
          text: new TextDecoder().decode(opened),
          createdAt: row.created_at,
        });
      }
      setChatMessagesMap((prev) => ({ ...prev, [orderId]: decrypted }));
    } catch (e) {
      console.error('Failed to load chat:', e);
    }
    if (!silent) setChatLoading(false);
  };

  const sendChatMessage = async (orderId: number, toAddress: string) => {
    if (!address || !chatInput.trim()) return;
    const textToSend = chatInput.trim();
    setChatSending(true);
    setChatUnavailable(null);
    setChatInput('');

    // Show the message right away using what was actually typed - no need
    // to wait for a round trip to the server just to display your own words.
    const optimisticMessage: ChatMessage = {
      id: -Date.now(),
      fromAddress: address,
      toAddress,
      text: textToSend,
      createdAt: new Date().toISOString(),
    };
    setChatMessagesMap((prev) => ({ ...prev, [orderId]: [...(prev[orderId] || []), optimisticMessage] }));

    try {
      const myKeys = await ensureChatKeyPair();
      const auth = await ensureChatSessionAuth();
      if (!myKeys || !auth) return;
      const theirPub = await fetchTheirPublicKey(toAddress);
      if (!theirPub) {
        setChatUnavailable(orderId);
        setChatMessagesMap((prev) => ({ ...prev, [orderId]: (prev[orderId] || []).filter((m) => m.id !== optimisticMessage.id) }));
        setChatSending(false);
        return;
      }

      const nonce = nacl.randomBytes(24);
      const plaintext = new TextEncoder().encode(textToSend);
      const cipher = nacl.box(plaintext, nonce, theirPub, myKeys.secretKey);
      const ciphertextHex = bytesToHexLocal(cipher);
      const nonceHex = bytesToHexLocal(nonce);

      const { error } = await supabase.functions.invoke('dispute-chat', {
        body: { action: 'sendMessage', contractAddress: MARKETPLACE_ADDRESS, orderId, walletAddress: address, toAddress, ciphertext: ciphertextHex, nonce: nonceHex, message: auth.message, signature: auth.signature },
      });
      if (error) {
        console.error('Failed to send message:', error);
        setChatMessagesMap((prev) => ({ ...prev, [orderId]: (prev[orderId] || []).filter((m) => m.id !== optimisticMessage.id) }));
        return;
      }
      // Quietly sync with the server in the background - the message is
      // already showing, this just confirms it and picks up anything new.
      loadChatMessages(orderId, true);
      // The notification stays generic ("you have a new message") on purpose -
      // chat is end-to-end encrypted, and the notification system never has
      // access to the actual plaintext, only that a message was sent.
      sendNotification(toAddress, '💬 New message', 'You have a new message about one of your orders.', orderId);
    } catch (e) {
      console.error('Failed to send message:', e);
    }
    setChatSending(false);
  };

  const loadEvidence = async (orderId: number) => {
    if (!address) return;
    const auth = await ensureChatSessionAuth();
    if (!auth) return;
    const { data, error } = await supabase.functions.invoke('dispute-chat', {
      body: { action: 'getEvidence', contractAddress: MARKETPLACE_ADDRESS, orderId, walletAddress: address, message: auth.message, signature: auth.signature },
    });
    if (error) { console.error('Failed to load evidence:', error); return; }
    const rows = data?.data || [];
    setEvidenceMap((prev) => ({
      ...prev,
      [orderId]: rows.map((r: any) => ({ id: r.id, submittedBy: r.submitted_by, imageUrl: r.image_url, note: r.note, createdAt: r.created_at })),
    }));
  };

  const submitEvidence = async (orderId: number) => {
    if (!address) return;
    if (!evidenceImageUrl.trim() && !evidenceNote.trim()) { alert('Add a photo or a note before submitting.'); return; }
    setEvidenceSubmitting(true);
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return;
      const { error } = await supabase.functions.invoke('dispute-chat', {
        body: { action: 'submitEvidence', contractAddress: MARKETPLACE_ADDRESS, orderId, walletAddress: address, imageUrl: evidenceImageUrl.trim(), note: evidenceNote.trim(), message: auth.message, signature: auth.signature },
      });
      if (error) { console.error('Failed to submit evidence:', error); return; }
      setEvidenceNote('');
      setEvidenceImageUrl('');
      await loadEvidence(orderId);
    } catch (e) {
      console.error('Failed to submit evidence:', e);
    }
    setEvidenceSubmitting(false);
  };

  const handleEvidenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEvidenceUploading(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setEvidenceImageUrl(url);
    } catch (err) {
      alert('Image upload failed. Please try again.');
    }
    setEvidenceUploading(false);
    e.target.value = '';
  };

  // ---------- REVIEWS ----------
  // Public to read (any buyer browsing a store should see them), signature-
  // gated to submit/edit - reuses the same session signature as chat/evidence.
  const loadSellerReviews = async (sellerAddress: string) => {
    const { data, error } = await supabase.functions.invoke('reviews', {
      body: { action: 'getReviews', contractAddress: MARKETPLACE_ADDRESS, sellerAddress, viewerAddress: address },
    });
    if (error) { console.error('Failed to load reviews:', error); return; }
    const rows = (data?.data || []).map((r: any) => ({
      orderId: r.order_id, listingId: r.listing_id, rating: r.rating,
      ratingItem: r.rating_item ?? null, ratingCommunication: r.rating_communication ?? null, ratingShipping: r.rating_shipping ?? null,
      reviewText: r.review_text, buyerAddress: r.buyer_address, createdAt: r.created_at, helpfulCount: r.helpful_count || 0,
    }));
    setSellerReviewsMap((prev) => ({ ...prev, [sellerAddress.toLowerCase()]: rows }));
    if (data?.votedOrderIds) setHelpfulVotedIds((prev) => new Set([...prev, ...data.votedOrderIds]));
  };

  // Toggles the current wallet's "Helpful" vote on a review - reuses the
  // same shared cached signature as everything else, so this never asks
  // for a fresh wallet prompt beyond the very first time ever.
  const toggleHelpful = async (orderId: number, sellerAddress: string) => {
    if (!address) { openWalletChoice(); return; }
    // Optimistic update first, so the button feels instant.
    const alreadyVoted = helpfulVotedIds.has(orderId);
    setHelpfulVotedIds((prev) => {
      const next = new Set(prev);
      if (alreadyVoted) next.delete(orderId); else next.add(orderId);
      return next;
    });
    setSellerReviewsMap((prev) => ({
      ...prev,
      [sellerAddress.toLowerCase()]: (prev[sellerAddress.toLowerCase()] || []).map((r) =>
        r.orderId === orderId ? { ...r, helpfulCount: Math.max(0, r.helpfulCount + (alreadyVoted ? -1 : 1)) } : r
      ),
    }));
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return;
      await supabase.functions.invoke('reviews', {
        body: { action: 'toggleHelpful', contractAddress: MARKETPLACE_ADDRESS, orderId, walletAddress: address, message: auth.message, signature: auth.signature },
      });
    } catch (e) {
      console.error('Failed to toggle helpful vote:', e);
    }
  };

  const openReviewModal = (orderId: number, sellerAddress: string) => {
    const existing = (sellerReviewsMap[sellerAddress.toLowerCase()] || []).find((r) => r.orderId === orderId);
    // Older reviews (submitted before the 3-part breakdown existed) won't
    // have these three saved separately - fall back to their old single
    // overall rating for all three fields in that case, so re-editing an
    // old review still starts from something sensible instead of blank.
    setReviewRatingItem(existing?.ratingItem ?? existing?.rating ?? 0);
    setReviewRatingCommunication(existing?.ratingCommunication ?? existing?.rating ?? 0);
    setReviewRatingShipping(existing?.ratingShipping ?? existing?.rating ?? 0);
    setReviewText(existing?.reviewText || '');
    setReviewModalOrderId(orderId);
  };

  const submitReview = async (orderId: number, listingId: number, sellerAddress: string) => {
    if (!address || reviewRatingItem < 1 || reviewRatingCommunication < 1 || reviewRatingShipping < 1) {
      alert('Please pick a star rating for all three categories.'); return;
    }
    setReviewSubmitting(true);
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return;
      const { error } = await supabase.functions.invoke('reviews', {
        body: {
          action: 'submitReview', contractAddress: MARKETPLACE_ADDRESS, orderId, listingId, sellerAddress,
          ratingItem: reviewRatingItem, ratingCommunication: reviewRatingCommunication, ratingShipping: reviewRatingShipping,
          reviewText: reviewText.trim(), walletAddress: address, message: auth.message, signature: auth.signature,
        },
      });
      if (error) { console.error('Failed to submit review:', error); alert('Failed to submit review. Please try again.'); return; }
      await loadSellerReviews(sellerAddress);
      const overallForNotification = Math.round((reviewRatingItem + reviewRatingCommunication + reviewRatingShipping) / 3);
      const reviewedListing = getListingById(listingId);
      sendNotification(sellerAddress, '⭐ New review', `You got a ${overallForNotification}-star review${reviewedListing ? ` on "${reviewedListing.name}"` : ''}.`, orderId);
      setReviewModalOrderId(null);
    } catch (e) {
      console.error('Failed to submit review:', e);
    }
    setReviewSubmitting(false);
  };

  const getSellerRatingSummary = (sellerAddress: string): { average: number; count: number } | null => {
    const reviews = sellerReviewsMap[sellerAddress.toLowerCase()];
    if (!reviews || reviews.length === 0) return null;
    const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return { average, count: reviews.length };
  };

  const [chatUnavailable, setChatUnavailable] = useState<number | null>(null);
  const [chatActivityMap, setChatActivityMap] = useState<Record<number, string>>({});
  const [chatSeenMap, setChatSeenMap] = useState<Record<number, string>>({});
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Loads the "when did each order's chat last have activity" info - no
  // signature needed, works for anyone including someone who's never signed
  // in to chat yet, so a notification can appear before they've set anything up.
  const loadChatActivity = async (orderIds: number[]) => {
    if (!address || orderIds.length === 0) return;
    const { data, error } = await supabase.functions.invoke('dispute-chat', {
      body: { action: 'getActivity', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address },
    });
    if (error) { console.error('Failed to load chat activity:', error); return; }
    setChatActivityMap(data?.data || {});
  };

  // "Seen" timestamps live in localStorage per wallet, so a message only
  // shows as unread until THIS wallet has actually opened that chat once -
  // not tied to whether encryption keys are set up.
  useEffect(() => {
    if (!address) return;
    const key = `openspace_chat_seen_${address.toLowerCase()}`;
    const raw = localStorage.getItem(key);
    if (raw) { try { setChatSeenMap(JSON.parse(raw)); } catch (e) {} }
  }, [address]);

  const markChatSeen = (orderId: number) => {
    if (!address) return;
    const key = `openspace_chat_seen_${address.toLowerCase()}`;
    setChatSeenMap((prev) => {
      const next = { ...prev, [orderId]: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  const hasUnreadChat = (orderId: number): boolean => {
    const latest = chatActivityMap[orderId];
    if (!latest) return false;
    const seen = chatSeenMap[orderId];
    return !seen || new Date(latest) > new Date(seen);
  };

  // Runs in the background regardless of whether any chat window is open -
  // this is what lets a notification appear on an order card even if the
  // person hasn't opened that chat (or set up encryption) yet.
  useEffect(() => {
    if (!address) return;
    const myOrderIds = allOrders
      .filter((o) => {
        const listing = getListingById(o.listingId);
        return o.buyer.toLowerCase() === address.toLowerCase() || (listing && listing.seller.toLowerCase() === address.toLowerCase());
      })
      .map((o) => o.id);
    if (myOrderIds.length === 0) return;

    loadChatActivity(myOrderIds);
    const interval = setInterval(() => loadChatActivity(myOrderIds), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, allOrders.length]);

  // Always jump to the newest message - both when a chat first opens and
  // whenever a new message arrives, instead of leaving people stuck at
  // whatever scroll position it happened to load at.
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatModalOrderId, chatMessagesMap[chatModalOrderId ?? -1]]);

  // While a chat window is open, quietly check for new messages - so a
  // reply shows up on its own instead of needing to close and reopen.
  useEffect(() => {
    if (chatModalOrderId === null) return;
    const interval = setInterval(() => {
      loadChatMessages(chatModalOrderId, true);
      markChatSeen(chatModalOrderId);
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatModalOrderId]);


  const checkIfModerator = async () => {
    if (!address) return false;
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return false;
      const { data } = await supabase.functions.invoke('dispute-chat', {
        body: { action: 'checkModerator', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address, message: auth.message, signature: auth.signature },
      });
      const result = !!data?.isModerator;
      setIsModeratorState(result);
      return result;
    } catch (e) {
      console.error('Moderator check failed:', e);
      return false;
    }
  };

  // Silently detects moderator status - deliberately no visible button, so
  // the concept of "moderator access" isn't exposed to every visitor. Only
  // runs the check if this wallet already has a saved chat signature (from
  // using chat before), so it NEVER pops up a surprise "sign this" request
  // just to check something the vast majority of wallets aren't. A real
  // moderator who hasn't chatted yet can open any chat once to "activate"
  // this automatically going forward.
  useEffect(() => {
    if (!address || isAdmin) return;
    const cacheKey = `openspace_chat_session_${address.toLowerCase()}`;
    if (localStorage.getItem(cacheKey)) checkIfModerator();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // ---------- NOTIFICATIONS (bell + browser push) ----------
  const loadNotifications = async () => {
    if (!address) return;
    const { data, error } = await supabase.functions.invoke('notifications', {
      body: { action: 'list', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address },
    });
    if (error) { console.error('Failed to load notifications:', error); return; }
    const rows = (data?.data || []).map((r: any) => ({
      id: r.id, orderId: r.order_id, title: r.title, body: r.body, seen: r.seen, createdAt: r.created_at,
    }));
    setNotifications(rows);
  };

  const markNotificationsSeen = async () => {
    if (!address) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));
    await supabase.functions.invoke('notifications', {
      body: { action: 'markSeen', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address },
    }).catch(() => {});
  };

  const unseenNotifCount = notifications.filter((n) => !n.seen).length;

  // Called right after a purchase confirms, once per seller involved -
  // writes the notification row (powers the bell) and best-effort sends a
  // push in the same call, so both channels reuse one round trip.
  // General-purpose notifier - any event (order, message, review, dispute,
  // shipping update, low stock, etc) sends its own title/body through this
  // one function, so every notification type reuses the same bell + push
  // pipeline instead of each needing its own plumbing.
  const sendNotification = async (walletAddress: string, title: string, body: string, orderId?: number) => {
    await supabase.functions.invoke('notifications', {
      body: {
        action: 'create',
        contractAddress: MARKETPLACE_ADDRESS,
        walletAddress,
        orderId: orderId ?? null,
        title,
        notifBody: body,
      },
    }).catch((e) => console.error('Failed to send notification:', e));
  };

  const notifySeller = async (sellerAddress: string, orderId: number, listingName: string) => {
    await sendNotification(sellerAddress, 'New order received', `Someone just bought "${listingName}" from your shop.`, orderId);
  };

  // Registers the service worker and subscribes this browser to push - only
  // runs after the seller explicitly agrees, since browsers require a user
  // gesture before asking for notification permission.
  const enablePushNotifications = async () => {
    if (!address) return;
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Push notifications aren\'t supported in this browser.');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      const { error } = await supabase.functions.invoke('notifications', {
        body: { action: 'subscribe', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address, subscription },
      });
      if (error) { console.error('Failed to save push subscription:', error); return; }
      setPushEnabled(true);
      localStorage.setItem(`openspace_push_enabled_${address.toLowerCase()}`, 'true');
    } catch (e) {
      console.error('Failed to enable push notifications:', e);
    }
  };

  const disablePushNotifications = async () => {
    if (!address) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw.js');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) await subscription.unsubscribe();
      await supabase.functions.invoke('notifications', {
        body: { action: 'unsubscribe', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address },
      });
    } catch (e) {
      console.error('Failed to disable push notifications:', e);
    }
    setPushEnabled(false);
    localStorage.removeItem(`openspace_push_enabled_${address.toLowerCase()}`);
  };

  // Restores whether this wallet already turned push on, so Wallet Settings
  // shows the right state without a round trip.
  useEffect(() => {
    if (!address) return;
    setPushEnabled(localStorage.getItem(`openspace_push_enabled_${address.toLowerCase()}`) === 'true');
  }, [address]);

  // Polls for new notifications while connected - same lightweight pattern
  // already used for chat activity.
  useEffect(() => {
    if (!address) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const loadSiteAnalytics = async () => {
    if (!address) return;
    setSiteAnalyticsLoading(true);
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return;
      const { data, error } = await supabase.functions.invoke('site-analytics', {
        body: { action: 'getAnalytics', contractAddress: MARKETPLACE_ADDRESS, walletAddress: address, message: auth.message, signature: auth.signature, days: 30 },
      });
      if (error) { console.error('Failed to load site analytics:', error); return; }
      setSiteAnalytics(data);
    } catch (e) {
      console.error('Failed to load site analytics:', e);
    }
    setSiteAnalyticsLoading(false);
  };

  const loadCaseStatus = async (orderIds: number[]) => {
    if (!address || orderIds.length === 0) return;
    const auth = await ensureChatSessionAuth();
    if (!auth) return;
    const { data, error } = await supabase.functions.invoke('dispute-chat', {
      body: { action: 'getCaseStatus', contractAddress: MARKETPLACE_ADDRESS, orderIds, walletAddress: address, message: auth.message, signature: auth.signature },
    });
    if (error) { console.error('Failed to load case status:', error); return; }
    const rows = data?.data || [];
    setCaseStatusMap((prev) => {
      const next = { ...prev };
      rows.forEach((r: any) => { next[r.order_id] = { claimedBy: r.claimed_by, note: r.moderator_note || '' }; });
      return next;
    });
  };

  const toggleClaimCase = async (orderId: number) => {
    if (!address) return;
    const auth = await ensureChatSessionAuth();
    if (!auth) return;
    const { data, error } = await supabase.functions.invoke('dispute-chat', {
      body: { action: 'claimCase', contractAddress: MARKETPLACE_ADDRESS, orderId, walletAddress: address, message: auth.message, signature: auth.signature },
    });
    if (error) { console.error('Failed to claim case:', error); return; }
    setCaseStatusMap((prev) => ({ ...prev, [orderId]: { claimedBy: data?.claimedBy ?? null, note: prev[orderId]?.note || '' } }));
  };

  const saveNote = async (orderId: number) => {
    if (!address) return;
    const auth = await ensureChatSessionAuth();
    if (!auth) return;
    const note = noteDrafts[orderId] ?? '';
    const { error } = await supabase.functions.invoke('dispute-chat', {
      body: { action: 'setNote', contractAddress: MARKETPLACE_ADDRESS, orderId, note, walletAddress: address, message: auth.message, signature: auth.signature },
    });
    if (error) { console.error('Failed to save note:', error); return; }
    setCaseStatusMap((prev) => ({ ...prev, [orderId]: { claimedBy: prev[orderId]?.claimedBy ?? null, note } }));
  };

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

  // Same lookup as getQvDisplayImage, but for any color (not just the
  // currently picked one) - used to show a real photo swatch per color
  // option instead of a plain text pill, reusing data the seller already
  // provided rather than needing anything new.
  const getQvColorSwatchImage = (color: string): string => {
    if (!quickViewListing || !qvColorImageData) return quickViewListing?.imageUrl || '';
    const ci = quickViewListing.colors.indexOf(color);
    const r = qvColorImageData[ci];
    const colorImg = r && r.status === 'success' && typeof r.result === 'string' ? r.result : '';
    return colorImg && colorImg.trim() !== '' ? colorImg : quickViewListing.imageUrl;
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
    setQvReviewFilter('all');
  }, [quickViewId]);

  // Shop name for whoever is selling the item currently open in Quick View -
  // public lookup, no signature needed, works for any visitor.
  const [quickViewSellerName, setQuickViewSellerName] = useState<string | null>(null);
  const [quickViewSellerJoined, setQuickViewSellerJoined] = useState<string | null>(null);
  const [sellerCardOpen, setSellerCardOpen] = useState(false);
  useEffect(() => {
    const sellerAddr = quickViewListing?.seller;
    setSellerCardOpen(false);
    if (!sellerAddr) { setQuickViewSellerName(null); setQuickViewSellerJoined(null); return; }
    setQuickViewSellerName(null);
    setQuickViewSellerJoined(null);
    supabase.functions.invoke('seller-profiles', {
      body: { action: 'getProfile', contractAddress: MARKETPLACE_ADDRESS, walletAddress: sellerAddr },
    }).then(({ data, error }) => {
      if (!error && data?.data?.shop_name) setQuickViewSellerName(data.data.shop_name);
      if (!error && data?.data?.created_at) setQuickViewSellerJoined(data.data.created_at);
    }).catch(() => {});
    loadSellerReviews(sellerAddr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quickViewListing?.seller]);

  // Extra photos/video for the item open in Quick View - public read, no
  // signature needed, same as anyone browsing can already see the main
  // photo. Resets to the on-chain main image whenever a different item is
  // opened.
  const [qvMediaList, setQvMediaList] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [qvMediaLoading, setQvMediaLoading] = useState(false);
  const [qvSelectedMediaIndex, setQvSelectedMediaIndex] = useState<number | null>(null);
  const qvVideoRef = useRef<HTMLVideoElement>(null);
  const [qvVideoPlaying, setQvVideoPlaying] = useState(true);
  const [qvVideoMuted, setQvVideoMuted] = useState(true);
  useEffect(() => {
    setQvSelectedMediaIndex(null);
    if (!quickViewId) { setQvMediaList([]); setQvMediaLoading(false); return; }
    setQvMediaList([]);
    setQvMediaLoading(true);
    supabase.functions.invoke('listing-media', {
      body: { action: 'get', contractAddress: MARKETPLACE_ADDRESS, listingId: quickViewId },
    }).then(({ data, error }) => {
      if (error) { console.error('Failed to load listing media:', error); setQvMediaList([]); return; }
      const rows = (data?.data || []).map((r: any) => ({ url: r.url, type: r.media_type }));
      setQvMediaList(rows);
    }).catch(() => setQvMediaList([])).finally(() => setQvMediaLoading(false));
  }, [quickViewId]);

  // Specifications + Description for the item open in Quick View - same
  // public, no-signature read as the media above.
  const [qvDescription, setQvDescription] = useState('');
  const [qvReviewFilter, setQvReviewFilter] = useState<'all' | 1 | 2 | 3 | 4 | 5>('all');
  const [qvSpecs, setQvSpecs] = useState<{ label: string; value: string }[]>([]);
  useEffect(() => {
    if (!quickViewId) { setQvDescription(''); setQvSpecs([]); return; }
    supabase.functions.invoke('listing-details', {
      body: { action: 'get', contractAddress: MARKETPLACE_ADDRESS, listingId: quickViewId },
    }).then(({ data, error }) => {
      if (error) { console.error('Failed to load listing details:', error); return; }
      setQvDescription(data?.data?.description || '');
      setQvSpecs(data?.data?.specs || []);
    }).catch(() => {});
  }, [quickViewId]);

  // Steps forward/back through the full gallery (the default photo, plus
  // every uploaded photo/video, in the same order the thumbnail rail shows
  // them) - powers the prev/next arrows on the main display, wrapping
  // around at each end.
  const qvGalleryStep = (direction: 1 | -1) => {
    const total = 1 + qvMediaList.length;
    const currentPos = qvSelectedMediaIndex === null ? 0 : qvSelectedMediaIndex + 1;
    const nextPos = (currentPos + direction + total) % total;
    setQvSelectedMediaIndex(nextPos === 0 ? null : nextPos - 1);
  };

  // A newly-selected video always starts playing (autoplay), so the play/
  // pause overlay icon should reflect that from the start, not whatever
  // the previous video was left showing.
  useEffect(() => {
    setQvVideoPlaying(true);
  }, [qvSelectedMediaIndex]);

  // ---------- LISTING FORM ----------
  const resetListForm = () => {
    setItemName(''); setItemImage(''); setItemPrice(''); setItemCurrency('BNB'); setItemCategory(CATEGORIES[0]);
    setItemStock(''); setColorsInput(''); setSizesInput(''); setStockMatrix({}); setColorImagesInput({}); setListMode('simple');
    setNewListingMedia([]);
    setNewListingDescription('');
    setNewListingSpecs([]);
  };

  const handleListSimple = async () => {
    if (!itemName.trim() || !itemPrice || Number(itemPrice) <= 0 || !itemStock || Number(itemStock) <= 0) {
      alert('Please enter a valid name, price, and stock quantity'); return;
    }
    const priceInWei = parseEther(itemPrice);
    const tokenAddress = LIST_CURRENCIES[itemCurrency].address;
    // Get a fresh, live listing count right before submitting - this reads
    // the actual on-chain counter itself, not the app's cached list of
    // known listings (which only re-reads whatever range it already knew
    // about, so its "length" never actually grows on its own - that was
    // the real bug behind extra photos/specs attaching to the wrong ID).
    let currentCount = lCount;
    try {
      const freshResult = await refetchListingCount();
      if (freshResult.data !== undefined) currentCount = Number(freshResult.data);
    } catch (e) {}
    if (newListingMedia.length > 0) setPendingListingMedia({ media: newListingMedia, startListingCount: currentCount });
    if (newListingDescription.trim() || newListingSpecs.length > 0) setPendingListingDetails({ description: newListingDescription.trim(), specs: newListingSpecs.filter((s) => s.label.trim() || s.value.trim()), startListingCount: currentCount });
    call('listItem', [itemName.trim(), itemImage.trim(), itemCategory, priceInWei, tokenAddress, BigInt(itemStock)], listingFeeWei);
    resetListForm();
  };

  const parsedColors = colorsInput.split(',').map((c) => c.trim()).filter(Boolean);
  const parsedSizes = sizesInput.split(',').map((s) => s.trim()).filter(Boolean);

  const handleListVariants = async () => {
    if (!itemName.trim() || !itemPrice || Number(itemPrice) <= 0) { alert('Please enter a valid name and price'); return; }
    if (parsedColors.length === 0 && parsedSizes.length === 0) { alert('Please enter at least a color or a size'); return; }
    const effectiveColors = parsedColors.length > 0 ? parsedColors : [NO_VARIANT];
    const effectiveSizes = parsedSizes.length > 0 ? parsedSizes : [NO_VARIANT];
    const matrix: bigint[] = [];
    for (const c of effectiveColors) {
      for (const s of effectiveSizes) {
        const key = `${c}|${s}`;
        const val = Number(stockMatrix[key] || '0');
        matrix.push(BigInt(val));
      }
    }
    const colorImagesArr = effectiveColors.map((c) => (colorImagesInput[c] || '').trim());
    const priceInWei = parseEther(itemPrice);
    const tokenAddress = LIST_CURRENCIES[itemCurrency].address;
    // Same freshness fix as handleListSimple above.
    let currentCount = lCount;
    try {
      const freshResult = await refetchListingCount();
      if (freshResult.data !== undefined) currentCount = Number(freshResult.data);
    } catch (e) {}
    if (newListingMedia.length > 0) setPendingListingMedia({ media: newListingMedia, startListingCount: currentCount });
    if (newListingDescription.trim() || newListingSpecs.length > 0) setPendingListingDetails({ description: newListingDescription.trim(), specs: newListingSpecs.filter((s) => s.label.trim() || s.value.trim()), startListingCount: currentCount });
    call('listItemWithVariants', [itemName.trim(), itemImage.trim(), itemCategory, priceInWei, tokenAddress, effectiveColors, effectiveSizes, matrix, colorImagesArr], listingFeeWei);
    resetListForm();
  };

  const openEditListing = (listing: Listing) => {
    setEditingListingId(listing.id);
    setEditName(listing.name);
    setEditImage(listing.imageUrl);
    setEditCategory(listing.category);
    setEditPrice((Number(listing.price) / 1e18).toString());
    setEditStock(listing.hasVariants ? '' : listing.simpleStock.toString());
    setEditVariantStock({});
    setEditColorImages({});
    setEditQueue([]);
    setEditQueueTotal(0);
    setEditQueueRunning(false);
    // Extra photos/video live in Supabase, not on-chain, so they're loaded
    // separately here with a plain public read - no signature needed just
    // to view them, same as everyone browsing the shop can already see them.
    setEditListingMedia([]);
    setEditListingMediaLoaded(false);
    supabase.functions.invoke('listing-media', {
      body: { action: 'get', contractAddress: MARKETPLACE_ADDRESS, listingId: listing.id },
    }).then(({ data, error }) => {
      if (error) { console.error('Failed to load listing media:', error); setEditListingMediaLoaded(true); return; }
      const rows = (data?.data || []).map((r: any) => ({ url: r.url, type: r.media_type }));
      setEditListingMedia(rows);
      setEditListingMediaLoaded(true);
    }).catch(() => setEditListingMediaLoaded(true));

    // Same idea for Specifications + Description - separate off-chain data,
    // separate load.
    setEditListingDescription('');
    setEditListingSpecs([]);
    setEditListingDetailsLoaded(false);
    supabase.functions.invoke('listing-details', {
      body: { action: 'get', contractAddress: MARKETPLACE_ADDRESS, listingId: listing.id },
    }).then(({ data, error }) => {
      if (error) { console.error('Failed to load listing details:', error); setEditListingDetailsLoaded(true); return; }
      setEditListingDescription(data?.data?.description || '');
      setEditListingSpecs(data?.data?.specs || []);
      setEditListingDetailsLoaded(true);
    }).catch(() => setEditListingDetailsLoaded(true));
  };

  const editingListing = editingListingId ? getListingById(editingListingId) : null;
  const editVariantStockContracts = editingListing && editingListing.hasVariants
    ? editingListing.colors.flatMap((c) => editingListing.sizes.map((s) => ({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getAvailableStock' as const, args: [BigInt(editingListing.id), c, s] as const,
      })))
    : [];
  const { data: editVariantStockData } = useReadContracts({ contracts: editVariantStockContracts, query: { enabled: editVariantStockContracts.length > 0 } });

  // Existing per-color images for the listing being edited, so the edit
  // modal can show and let the seller change them - the same way they're
  // set up when the item is first listed.
  const editColorImageContracts = editingListing && editingListing.hasVariants
    ? editingListing.colors.map((c) => ({
        address: MARKETPLACE_ADDRESS, abi: MARKETPLACE_ABI, functionName: 'getColorImage' as const, args: [BigInt(editingListing.id), c] as const,
      }))
    : [];
  const { data: editColorImageData } = useReadContracts({ contracts: editColorImageContracts, query: { enabled: editColorImageContracts.length > 0 } });

  const getEditVariantStockValue = (color: string, size: string): string => {
    const key = `${color}|${size}`;
    if (editVariantStock[key] !== undefined) return editVariantStock[key];
    return getOriginalVariantStockValue(color, size);
  };

  // Reads ONLY the on-chain value, ignoring any unsaved draft - used to
  // detect whether a field actually changed before including it in the
  // save queue, so we never fire a transaction for a value nobody touched.
  const getOriginalVariantStockValue = (color: string, size: string): string => {
    if (!editingListing || !editVariantStockData) return '';
    const ci = editingListing.colors.indexOf(color);
    const si = editingListing.sizes.indexOf(size);
    const idx = ci * editingListing.sizes.length + si;
    const r = editVariantStockData[idx];
    return r && r.status === 'success' && r.result !== undefined ? String(r.result) : '';
  };

  const getEditColorImageValue = (color: string): string => {
    if (editColorImages[color] !== undefined) return editColorImages[color];
    return getOriginalColorImageValue(color);
  };

  const getOriginalColorImageValue = (color: string): string => {
    if (!editingListing || !editColorImageData) return '';
    const ci = editingListing.colors.indexOf(color);
    const r = editColorImageData[ci];
    return r && r.status === 'success' && typeof r.result === 'string' ? r.result : '';
  };

  // Photos/video live in Supabase, not on-chain, so saving them never needs
  // a blockchain transaction - just the one shared cached signature (only
  // asked for the very first time a wallet ever uses any Supabase-backed
  // feature). Runs independently of whatever on-chain price/stock changes
  // might also be queued.
  const saveListingMediaEdits = async () => {
    if (!editingListingId || !address || !editListingMediaLoaded) return;
    setSavingListingMedia(true);
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return;
      await supabase.functions.invoke('listing-media', {
        body: { action: 'save', contractAddress: MARKETPLACE_ADDRESS, listingId: editingListingId, sellerAddress: address, media: editListingMedia, message: auth.message, signature: auth.signature },
      });
    } catch (e) {
      console.error('Failed to save listing media:', e);
    }
    setSavingListingMedia(false);
  };

  const saveListingDetailsEdits = async () => {
    if (!editingListingId || !address || !editListingDetailsLoaded) return;
    setSavingListingDetails(true);
    try {
      const auth = await ensureChatSessionAuth();
      if (!auth) return;
      await supabase.functions.invoke('listing-details', {
        body: {
          action: 'save', contractAddress: MARKETPLACE_ADDRESS, listingId: editingListingId, sellerAddress: address,
          description: editListingDescription.trim(),
          specs: editListingSpecs.filter((s) => s.label.trim() || s.value.trim()),
          message: auth.message, signature: auth.signature,
        },
      });
    } catch (e) {
      console.error('Failed to save listing details:', e);
    }
    setSavingListingDetails(false);
  };

  const saveEditListing = () => {
    if (!editingListingId) return;
    if (!editName.trim() || !editPrice || Number(editPrice) <= 0) { alert('Please enter a valid name and price'); return; }
    const listing = getListingById(editingListingId);
    if (!listing) return;

    const priceInWei = parseEther(editPrice);
    const queue: { functionName: string; args: any[] }[] = [];

    // Only queue the core details update if something in it actually
    // changed - editing just the stock shouldn't also resend an identical
    // name/image/category/price and cost an extra confirmation for nothing.
    const nameChanged = editName.trim() !== listing.name;
    const imageChanged = editImage.trim() !== listing.imageUrl;
    const categoryChanged = editCategory !== listing.category;
    const priceChanged = priceInWei !== listing.price;
    if (nameChanged || imageChanged || categoryChanged || priceChanged) {
      queue.push({ functionName: 'updateListing', args: [BigInt(editingListingId), editName.trim(), editImage.trim(), editCategory, priceInWei] });
    }

    if (!listing.hasVariants) {
      const currentStock = listing.simpleStock.toString();
      if (editStock !== '' && editStock !== currentStock && Number(editStock) >= 0) {
        queue.push({ functionName: 'updateSimpleStock', args: [BigInt(editingListingId), BigInt(editStock)] });
      }
    } else {
      Object.entries(editVariantStock).forEach(([key, val]) => {
        if (val === '' || Number(val) < 0) return;
        const [color, size] = key.split('|');
        if (val === getOriginalVariantStockValue(color, size)) return;
        queue.push({ functionName: 'updateVariantStock', args: [BigInt(editingListingId), color, size, BigInt(val)] });
      });
      listing.colors.forEach((c) => {
        const draft = editColorImages[c];
        if (draft === undefined) return;
        if (draft.trim() === getOriginalColorImageValue(c)) return;
        queue.push({ functionName: 'updateColorImage', args: [BigInt(editingListingId), c, draft.trim()] });
      });
    }

    // Photos/video are off-chain, so they save right away, regardless of
    // whether anything on-chain also changed.
    saveListingMediaEdits();
    saveListingDetailsEdits();

    if (queue.length === 0) { setEditingListingId(null); return; }
    setEditQueueTotal(queue.length);
    setEditQueue(queue);
    setEditQueueRunning(true);
    call(queue[0].functionName, queue[0].args);
  };

  // ---------- ADS: SUBSCRIPTION + FEATURED PICKER ----------
  const handleSubscribeToAds = () => {
    call('subscribeToAds', [], adSubscriptionFeeWei);
  };

  useEffect(() => {
    if (!featuredPickerInitialized && myFeaturedListingsData) {
      setSelectedFeaturedIds((myFeaturedListingsData as bigint[]).map((id) => Number(id)));
      setFeaturedPickerInitialized(true);
    }
  }, [myFeaturedListingsData, featuredPickerInitialized]);

  // Auto-claim the one-time welcome bonus whenever a connected wallet is confirmed
  // not to have claimed it yet. Retries on every fresh page load/visit (not just
  // once ever) so a missed signature or a brief network hiccup doesn't permanently
  // block the bonus - hasClaimedWelcomeBonusAttemptedRef only stops it firing
  // more than once within a single page load while the transaction is pending.
  const welcomeClaimAttemptedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || !address) return;
    if (hasClaimedWelcomeData === undefined) return;
    if (hasClaimedWelcome) { welcomeClaimAttemptedRef.current = false; return; }
    if (welcomeClaimAttemptedRef.current) return;
    welcomeClaimAttemptedRef.current = true;
    call('claimWelcomeBonus', []);
  }, [isConnected, address, hasClaimedWelcomeData, hasClaimedWelcome]);

  // Capture ?ref=0x... from the URL once, and once a wallet connects, record the
  // referral relationship on-chain (no points yet - those only pay out the first
  // time this user actually lists or buys something, per the contract logic).
  const referralLinkAttemptedRef = useRef(false);
  useEffect(() => {
    if (!isConnected || !address) return;
    if (myReferrerData === undefined) return;
    const isAlreadyLinked = myReferrerData && (myReferrerData as string) !== ZERO_ADDRESS;
    if (isAlreadyLinked) { referralLinkAttemptedRef.current = false; return; }
    if (referralLinkAttemptedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (!ref || !ref.startsWith('0x') || ref.length !== 42) return;
    if (ref.toLowerCase() === address.toLowerCase()) return;

    referralLinkAttemptedRef.current = true;
    call('setReferrer', [ref]);
  }, [isConnected, address, myReferrerData]);

  const myReferralLink = address ? `${typeof window !== 'undefined' ? window.location.origin : ''}?ref=${address}` : '';
  const copyReferralLink = () => {
    if (!myReferralLink) return;
    navigator.clipboard.writeText(myReferralLink);
    setReferralLinkCopied(true);
    setTimeout(() => setReferralLinkCopied(false), 2000);
  };

  const toggleFeaturedSelection = (listingId: number) => {
    setSelectedFeaturedIds((prev) => {
      if (prev.includes(listingId)) return prev.filter((id) => id !== listingId);
      if (prev.length >= 3) { alert('You can feature up to 3 items at a time.'); return prev; }
      return [...prev, listingId];
    });
  };

  const saveFeaturedSelection = () => {
    call('setFeaturedListings', [selectedFeaturedIds.map((id) => BigInt(id))]);
  };

  // ---------- ADMIN ----------
  const openAdminSettings = () => {
    setNewListingFee(formatEther(listingFeeWei));
    setNewAdFee(formatEther(adSubscriptionFeeWei));
    setNewAdDurationDays(adSubscriptionDurationSeconds ? String(Math.round(adSubscriptionDurationSeconds / 86400)) : '');
    setNewPointsPerListing(pointsPerListingData !== undefined ? String(pointsPerListingData) : '');
    setNewPointsPerPurchase(pointsPerPurchaseData !== undefined ? String(pointsPerPurchaseData) : '');
    setNewPointsPerSale(pointsPerSaleData !== undefined ? String(pointsPerSaleData) : '');
    setNewWelcomeBonus(welcomeBonusPointsData !== undefined ? String(welcomeBonusPointsData) : '');
    setNewReferralPoints(referralPointsData !== undefined ? String(referralPointsData) : '');
    setNewRefereeBonusPoints(refereeBonusPointsData !== undefined ? String(refereeBonusPointsData) : '');
    setAdminSettingsOpen(true);
  };

  const saveAdminSettings = () => {
    if (newListingFee && Number(newListingFee) >= 0) {
      call('setListingFee', [parseEther(newListingFee)]);
    }
    if (newAdFee && Number(newAdFee) >= 0) {
      call('setAdSubscriptionFee', [parseEther(newAdFee)]);
    }
    if (newAdDurationDays && Number(newAdDurationDays) > 0) {
      call('setAdSubscriptionDuration', [BigInt(Number(newAdDurationDays) * 86400)]);
    }
    if (newPointsPerListing && Number(newPointsPerListing) >= 0) {
      call('setPointsPerListing', [BigInt(newPointsPerListing)]);
    }
    if (newPointsPerPurchase && Number(newPointsPerPurchase) >= 0) {
      call('setPointsPerPurchase', [BigInt(newPointsPerPurchase)]);
    }
    if (newPointsPerSale && Number(newPointsPerSale) >= 0) {
      call('setPointsPerSale', [BigInt(newPointsPerSale)]);
    }
    if (newWelcomeBonus && Number(newWelcomeBonus) >= 0) {
      call('setWelcomeBonusPoints', [BigInt(newWelcomeBonus)]);
    }
    if (newReferralPoints && Number(newReferralPoints) >= 0) {
      call('setReferralPoints', [BigInt(newReferralPoints)]);
    }
    if (newRefereeBonusPoints && Number(newRefereeBonusPoints) >= 0) {
      call('setRefereeBonusPoints', [BigInt(newRefereeBonusPoints)]);
    }
  };

  const togglePointsSystem = () => {
    call('setPointsSystemActive', [!pointsSystemActiveNow]);
  };

  const handleAdminDelist = () => {
    if (!modListingId || !modReason.trim()) { alert('Please enter a listing ID and a reason'); return; }
    const targetListing = getListingById(Number(modListingId));
    call('adminDelistItem', [BigInt(modListingId), modReason.trim()]);
    if (targetListing) {
      sendNotification(targetListing.seller, '🏪 Listing removed', `"${targetListing.name}" was removed by an admin. Reason: ${modReason.trim()}`);
    }
    setModListingId(''); setModReason('');
  };

  const handleAdminRemoveFeatured = () => {
    if (!modFeaturedListingId) { alert('Please enter a listing ID'); return; }
    call('adminRemoveFromFeatured', [BigInt(modFeaturedListingId)]);
    setModFeaturedListingId('');
  };

  // ---------- CART ----------
  const addToCart = (listing: Listing, color: string, size: string) => {
    if (cartCurrency && cartCurrency.toLowerCase() !== listing.paymentToken.toLowerCase()) {
      alert(`Your cart is currently in ${currencySymbol(cartCurrency)}. Clear it first to add items in a different currency.`);
      return;
    }
    const line = { listingId: listing.id, color, size };
    setCart((prev) => [...prev, line]);
    setCartCurrency(listing.paymentToken);
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) setCartCurrency(null);
      return next;
    });
  };

  const cartSubtotal = cart.reduce((sum, line) => {
    const listing = getListingById(line.listingId);
    return sum + (listing ? listing.price : BigInt(0));
  }, BigInt(0));
  const cartTotal = withBuyerFee(cartSubtotal);

  const proceedToCheckout = (lines: CartLine[], token: string) => {
    const subtotal = lines.reduce((sum, line) => {
      const listing = getListingById(line.listingId);
      return sum + (listing ? listing.price : BigInt(0));
    }, BigInt(0));
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

  const confirmShippingAndBuy = () => {
    if (!shippingForm.fullName.trim() || !shippingForm.address.trim()) { alert('Please fill in at least your name and address'); return; }
    if (cart.length === 0 || !cartCurrency) return;
    const sellerAddresses = cart.map((line) => getListingById(line.listingId)?.seller || '');
    const listingNames = cart.map((line) => getListingById(line.listingId)?.name || 'an item');
    const listingIds = cart.map((line) => line.listingId);
    setPendingShippingSave({ info: shippingForm, startOrderCount: oCount, numItems: cart.length, sellerAddresses, listingNames, listingIds });
    proceedToCheckout(cart, cartCurrency);
    setCart([]);
    setCartCurrency(null);
    setShippingModal(false);
  };

  // Sponsored strip auto-scroll. Runs continuously like before, but driven by
  // JS incrementing scrollLeft (instead of a fixed-speed CSS animation) so we
  // can slow it down and let Prev/Next buttons nudge it on demand - pausing
  // briefly whenever someone interacts with it, then resuming on its own.
  const adStripRef = useRef<HTMLDivElement>(null);
  const adStripPausedRef = useRef(false);
  useEffect(() => {
    const interval = setInterval(() => {
      const el = adStripRef.current;
      if (!el || adStripPausedRef.current) return;
      if (el.scrollWidth <= el.clientWidth) return;
      if (el.scrollLeft >= el.scrollWidth / 2) {
        el.scrollLeft -= el.scrollWidth / 2;
      } else {
        el.scrollLeft += 1.2;
      }
    }, 30);
    return () => clearInterval(interval);
  }, []);
  const scrollAdStrip = (dir: 'prev' | 'next') => {
    if (!adStripRef.current) return;
    adStripPausedRef.current = true;
    adStripRef.current.scrollBy({ left: dir === 'next' ? 240 : -240, behavior: 'smooth' });
    setTimeout(() => { adStripPausedRef.current = false; }, 2500);
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
  const priceFilterUsable = filterAddress !== null; // only meaningful once one specific currency is picked
  const minPriceWei = priceFilterUsable && minPrice && !isNaN(Number(minPrice)) ? parseEther(minPrice) : null;
  const maxPriceWei = priceFilterUsable && maxPrice && !isNaN(Number(maxPrice)) ? parseEther(maxPrice) : null;

  const shopListings = allListings.filter((l) => {
    if (l.delisted) return false;
    if (!l.hasVariants && l.simpleStock <= BigInt(0)) return false;
    if (filterAddress !== null && l.paymentToken.toLowerCase() !== filterAddress.toLowerCase()) return false;
    if (viewCategory !== ALL_CATEGORIES && l.category !== viewCategory) return false;
    if (searchQuery.trim() && !l.name.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    if (minPriceWei !== null && l.price < minPriceWei) return false;
    if (maxPriceWei !== null && l.price > maxPriceWei) return false;
    return true;
  }).sort((a, b) => {
    if (sortOrder === 'price_low') return a.price < b.price ? -1 : a.price > b.price ? 1 : 0;
    if (sortOrder === 'price_high') return a.price > b.price ? -1 : a.price < b.price ? 1 : 0;
    return b.id - a.id; // newest first - higher listing ID means listed more recently
  });

  const adListings = allListings.filter((l) => !l.delisted && l.isFeaturedNow);
  const adStrip = adListings.length > 0 ? [...adListings, ...adListings] : [];

  const myListings = isConnected ? allListings.filter((l) => l.seller.toLowerCase() === address?.toLowerCase() && !l.delisted) : [];
  const myOrdersToFulfill = isConnected ? allOrders.filter((o) => {
    const listing = getListingById(o.listingId);
    return listing && listing.seller.toLowerCase() === address?.toLowerCase() && !o.released && !o.cancelled;
  }) : [];
  const historyFromTs = historyFromDate ? new Date(historyFromDate).getTime() / 1000 : null;
  const historyToTs = historyToDate ? new Date(historyToDate).getTime() / 1000 + 86400 : null; // include the whole end day
  const mySoldHistory = isConnected ? allOrders.filter((o) => {
    const listing = getListingById(o.listingId);
    if (!listing || listing.seller.toLowerCase() !== address?.toLowerCase()) return false;
    if (!(o.released || o.cancelled)) return false;
    if (hiddenOrderIds.has(o.id)) return false;
    if (historyFromTs !== null && Number(o.purchaseTime) < historyFromTs) return false;
    if (historyToTs !== null && Number(o.purchaseTime) > historyToTs) return false;
    return true;
  }).sort((a, b) => Number(b.purchaseTime) - Number(a.purchaseTime)) : [];
  const myPurchases = isConnected ? allOrders.filter((o) => o.buyer.toLowerCase() === address?.toLowerCase()) : [];
  const disputeEligible = isConnected ? allOrders.filter((o) => {
    const listing = getListingById(o.listingId);
    return !o.released && !o.cancelled && !o.disputed &&
      (o.buyer.toLowerCase() === address?.toLowerCase() || (listing && listing.seller.toLowerCase() === address?.toLowerCase()));
  }) : [];
  const disputedOrders = allOrders.filter((o) => o.disputed && !o.released);
  const resolvedDisputedOrders = allOrders.filter((o) => o.disputed && o.released);

  const totalListed = allListings.length;
  const totalSold = allOrders.length;
  const totalReleased = allOrders.filter((o) => o.released).length;
  const totalCancelled = allOrders.filter((o) => o.cancelled).length;
  const totalActiveDisputes = disputedOrders.length;
  const totalDelisted = allListings.filter((l) => l.delisted).length;
  const chartMax = Math.max(totalListed, 1);
  const analyticsStats = [
    { label: 'Total Items Listed', value: totalListed, color: '#a3e635' },
    { label: 'Total Sold', value: totalSold, color: '#38bdf8' },
    { label: 'Funds Released', value: totalReleased, color: '#34d399' },
    { label: 'Cancelled / Refunded', value: totalCancelled, color: '#fbbf24' },
    { label: 'Active Disputes', value: totalActiveDisputes, color: '#f87171' },
    { label: 'Delisted', value: totalDelisted, color: '#a78bfa' },
  ];

  const checkoutSummary = cart.length > 0 ? { subtotal: cartSubtotal, fee: cartTotal - cartSubtotal, total: cartTotal, symbol: cartCurrency ? currencySymbol(cartCurrency) : '' } : null;

  const qvHasColors = quickViewListing ? quickViewListing.colors.some((c) => c !== NO_VARIANT) : false;
  const qvHasSizes = quickViewListing ? quickViewListing.sizes.some((s) => s !== NO_VARIANT) : false;
  const qvColorReady = !qvHasColors || !!pickedColor;
  const qvSizeReady = !qvHasSizes || !!pickedSize;
  const canAddQuickViewToCart = quickViewListing && (!quickViewListing.hasVariants || (qvColorReady && qvSizeReady && getQvStock(qvHasColors ? pickedColor : NO_VARIANT, qvHasSizes ? pickedSize : NO_VARIANT) > 0));
  const isOwnQuickViewListing = quickViewListing && address && quickViewListing.seller.toLowerCase() === address.toLowerCase();

  const renderShopThumb = (listing: Listing) => {
    const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
    return (
      <button
        key={listing.id}
        onClick={() => setQuickViewId(listing.id)}
        className={`group text-left ${cardBg} rounded-2xl overflow-hidden border ${cardBorder} hover:border-lime-400/60 transition-all duration-300`}
      >
        <div className={`w-full aspect-square ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} overflow-hidden relative`}>
          <img src={displayImage} alt={listing.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
          {listing.hasVariants && (
            <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-semibold ${darkMode ? 'bg-zinc-950/80 text-white' : 'bg-white/90 text-zinc-900'}`}>
              {listing.colors.length}c / {listing.sizes.length}s
            </span>
          )}
        </div>
        <div className="px-2.5 py-2">
          <p className="text-sm font-medium truncate">{listing.name}</p>
        </div>
      </button>
    );
  };

  const renderOrderCard = (order: Order, context: 'buyer' | 'seller') => {
    const listing = getListingById(order.listingId);
    if (!listing) return null;
    const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
    const symbol = currencySymbol(listing.paymentToken);
    const shipInfo = context === 'seller' ? (shippingInfoMap[order.id] ?? null) : null;
    const isBuyer = isConnected && address?.toLowerCase() === order.buyer.toLowerCase();
    const isSeller = isConnected && address?.toLowerCase() === listing.seller.toLowerCase();

    const statusOrActions = () => {
      if (order.released) {
        const myReview = context === 'buyer' && isBuyer
          ? (sellerReviewsMap[listing.seller.toLowerCase()] || []).find((r) => r.orderId === order.id)
          : undefined;
        return (
          <div className="space-y-2">
            <div className={`w-full py-2.5 text-center ${darkMode ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-500'} rounded-2xl font-medium border ${cardBorder}`}>Completed</div>
            {context === 'buyer' && isBuyer && (
              <button onClick={() => openReviewModal(order.id, listing.seller)} className={`w-full py-2 text-sm font-medium border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} transition-colors`}>
                {myReview ? `⭐ Edit Your Review (${myReview.rating}★)` : '⭐ Leave a Review'}
              </button>
            )}
          </div>
        );
      }
      if (order.cancelled) return <div className={`w-full py-2.5 text-center ${darkMode ? 'bg-white/5 text-zinc-500' : 'bg-zinc-100 text-zinc-500'} rounded-2xl font-medium border ${cardBorder}`}>Cancelled</div>;
      if (order.disputed) return <div className="w-full py-2 text-center bg-amber-400/20 text-amber-600 rounded-2xl font-medium border border-amber-400/40 text-sm">⚠ Under Dispute</div>;
      if (context === 'buyer' && isBuyer) {
        return (
          <button onClick={() => call('releaseFunds', [BigInt(order.id)])} disabled={isPending} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
            Release Funds to Seller
          </button>
        );
      }
      if (context === 'seller' && isSeller) {
        return (
          <button
            onClick={() => {
              setPendingActionNotify({
                toAddress: order.buyer,
                title: '❌ Order cancelled',
                body: `"${listing.name}" was cancelled and refunded by the seller.`,
                orderId: order.id,
              });
              call('cancelAndRefund', [BigInt(order.id)]);
            }}
            disabled={isPending}
            className={`w-full py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}
          >
            Cancel &amp; Refund Buyer
          </button>
        );
      }
      return <div className={`w-full py-2.5 text-center ${subtleText} text-sm`}>Awaiting buyer confirmation</div>;
    };

    return (
      <div key={order.id} className={`group relative ${cardBg} rounded-3xl overflow-hidden border ${cardBorder} hover:border-lime-400/60 transition-all duration-300`}>
        <div className={`w-full aspect-[4/3] sm:aspect-square ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} overflow-hidden relative`}>
          <img src={displayImage} alt={listing.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
          {listing.category && (
            <span className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold ${darkMode ? 'bg-zinc-950/80 text-white' : 'bg-white/90 text-zinc-900'} backdrop-blur-sm`}>
              {listing.category}
            </span>
          )}
        </div>
        <div className="p-4 sm:p-6">
          <h3 className="font-semibold text-lg sm:text-xl mb-1">{listing.name}</h3>
          {(order.color || order.size) && (
            <p className={`text-xs ${subtleText} mb-2`}>
              {order.color && `Color: ${order.color}`}{order.color && order.size ? ' · ' : ''}{order.size && `Size: ${order.size}`}
            </p>
          )}
          <p className={`text-xs ${subtleText} font-mono mb-3 sm:mb-4`}>
            {context === 'seller' ? `Buyer: ${order.buyer.slice(0, 6)}...${order.buyer.slice(-4)}` : `Seller: ${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`}
          </p>
          <span className="text-xl sm:text-2xl font-mono block mb-3 sm:mb-4 bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
            {(Number(listing.price) / 1e18).toString()} {symbol}
          </span>

          {shipInfo ? (
            <div className={`mb-4 p-3 rounded-xl text-xs ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder}`}>
              <p className={`${subtleText} uppercase tracking-wide text-[10px] mb-1 font-semibold`}>Ship to</p>
              <p className="font-medium">{shipInfo.fullName}</p>
              <p className={subtleText}>{shipInfo.address}, {shipInfo.city}{shipInfo.state ? `, ${shipInfo.state}` : ''}, {shipInfo.country}</p>
              {shipInfo.phone && <p className={subtleText}>{shipInfo.phone}</p>}
            </div>
          ) : context === 'seller' && (
            <p className={`mb-4 text-xs ${subtleText}`}>Tap "Unlock Shipping Info" above to view the buyer's address.</p>
          )}

          {!order.cancelled && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                {SHIPPING_LABELS.map((label, i) => (<span key={label} className={`text-[10px] font-semibold uppercase ${i <= order.shippingStatus ? 'text-sky-500' : subtleText}`}>{label}</span>))}
              </div>
              <div className={`h-1.5 rounded-full ${darkMode ? 'bg-white/10' : 'bg-zinc-100'} overflow-hidden`}>
                <div className="h-full bg-gradient-to-r from-sky-400 to-lime-400 transition-all duration-500" style={{ width: `${(order.shippingStatus / 2) * 100}%` }} />
              </div>
              {context === 'seller' && isSeller && order.shippingStatus < 2 && !order.released && !order.disputed && (
                <button
                  onClick={() => {
                    const newStatus = order.shippingStatus + 1;
                    setPendingActionNotify({
                      toAddress: order.buyer,
                      title: newStatus === 2 ? '📦 Order delivered' : '📦 Order shipped',
                      body: `"${listing.name}" is now marked as ${SHIPPING_LABELS[newStatus]}.`,
                      orderId: order.id,
                    });
                    call('updateShippingStatus', [BigInt(order.id), newStatus]);
                  }}
                  className="mt-2 text-xs text-sky-500 hover:text-sky-600 font-medium"
                >
                  Mark as {SHIPPING_LABELS[order.shippingStatus + 1]} →
                </button>
              )}
            </div>
          )}

          {(isBuyer || isSeller) && (
            <button
              onClick={() => { const otherParty = isBuyer ? listing.seller : order.buyer; setChatUnavailable(null); setChatModalOrderId(order.id); loadChatMessages(order.id, chatMessagesMap[order.id] !== undefined); markChatSeen(order.id); }}
              className={`relative w-full mb-2 py-2 text-sm font-medium border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} transition-colors`}
            >
              💬 Message {isBuyer ? 'Seller' : 'Buyer'}
              {hasUnreadChat(order.id) && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              )}
            </button>
          )}

          {order.disputed && (isBuyer || isSeller) && (
            <button
              onClick={() => { setEvidenceModalOrderId(order.id); loadEvidence(order.id); loadCaseStatus([order.id]); }}
              className="w-full mb-4 py-2 text-sm font-medium border border-amber-400/40 text-amber-600 rounded-xl hover:bg-amber-400/10 transition-colors"
            >
              📋 Dispute Evidence
            </button>
          )}

          {statusOrActions()}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${bg} ${text} transition-colors duration-300 pb-12 flex flex-col overflow-x-hidden`}>
      <header className={`border-b ${cardBorder} sticky top-0 ${headerBg} backdrop-blur-xl z-50`}>
        {privyAuthenticated && !isConnected && !walletSetupTimedOut && (
          <div className="bg-sky-500 text-white text-xs font-medium py-2 px-4 flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
            Finishing sign-in, setting up your wallet...
          </div>
        )}
        {privyAuthenticated && !isConnected && walletSetupTimedOut && (
          <div className="bg-amber-500 text-white text-xs font-medium py-2 px-4 flex items-center justify-center gap-2 flex-wrap text-center">
            <span>Your wallet is taking longer than usual to set up.</span>
            <button onClick={() => window.location.reload()} className="underline font-semibold shrink-0">Try Again</button>
          </div>
        )}

        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
          <button onClick={() => { setActiveTab('shop'); setQuickViewId(null); setMenuOpen(false); }} className="shrink-0" aria-label="Go to homepage">
            <OpenSpaceBrand imgClassName="h-10 sm:h-14 w-auto" textClassName="text-xl sm:text-2xl" />
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <button onClick={() => setCurrencyMenuOpen((v) => !v)} title="Filter by currency" className="w-10 h-10 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-2xl">
                💱
              </button>
              {currencyMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setCurrencyMenuOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-44 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50`}>
                    {Object.keys(VIEW_CURRENCIES).map((key) => (
                      <button key={key} onClick={() => { setViewCurrency(key); setCurrencyMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium ${viewCurrency === key ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>
                        {VIEW_CURRENCIES[key].label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button onClick={() => setCartOpen(true)} className="relative w-10 h-10 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
              <TrolleyIcon className="w-6 h-6" />
              {cart.length > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{cart.length}</span>)}
            </button>

            {isConnected && (
              <div className="relative">
                <button onClick={() => { setNotifBellOpen((v) => !v); if (!notifBellOpen && unseenNotifCount > 0) markNotificationsSeen(); }} className="relative w-10 h-10 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-2xl">
                  🔔
                  {unseenNotifCount > 0 && (<span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{unseenNotifCount}</span>)}
                </button>
                {notifBellOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifBellOpen(false)} />
                    <div className={`absolute right-0 mt-2 w-80 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50 max-h-96 overflow-y-auto`}>
                      <div className={`px-4 py-3 border-b ${cardBorder} flex items-center justify-between`}>
                        <p className="font-semibold text-sm">Notifications</p>
                        {!pushEnabled && (
                          <button onClick={enablePushNotifications} className="text-[11px] text-sky-500 hover:text-sky-600 font-medium">Enable push</button>
                        )}
                      </div>
                      {notifications.length === 0 ? (
                        <p className={`text-sm ${subtleText} text-center py-8 px-4`}>No notifications yet.</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={`px-4 py-3 border-b ${cardBorder} last:border-b-0 ${!n.seen ? (darkMode ? 'bg-white/5' : 'bg-lime-50') : ''}`}>
                            <p className="text-sm font-medium">{n.title}</p>
                            <p className={`text-xs ${subtleText} mt-0.5`}>{n.body}</p>
                            <p className={`text-[10px] ${subtleText} mt-1`}>{new Date(n.createdAt).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="w-10 h-10 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform text-2xl">
                ☰
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className={`absolute right-0 mt-2 w-64 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50 max-h-[75vh] overflow-y-auto`}>
                    <div className="p-2">
                      <div className="space-y-1">
                        <button onClick={() => { setActiveTab('shop'); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'shop' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>🛍 Buy</button>
                        <button onClick={() => { setActiveTab('sell'); setMenuOpen(false); if (!sellerProfile) { setSellerOnboardStep(1); setSellerOnboardOpen(true); } }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'sell' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>🏪 Become a Seller / Merchant</button>
                        {isAdmin && (<button onClick={() => { setActiveTab('analytics'); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${activeTab === 'analytics' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>📊 Analytics</button>)}
                      </div>
                      <div className={`border-t ${cardBorder} mt-2 pt-2 space-y-1`}>
                        <button onClick={() => setDarkMode(!darkMode)} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>{darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}</button>
                        <button onClick={() => { setHelpModalOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>❓ How to Test</button>
                        {isConnected && disputeEligible.length > 0 && (<button onClick={() => { setDisputeCenterOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-red-500 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>⚠ Open Dispute</button>)}
                        {(isAdmin || isModeratorState) && (disputedOrders.length > 0 || resolvedDisputedOrders.length > 0) && (<button onClick={() => { setResolveCenterOpen(true); setMenuOpen(false); setDisputeQueueTab('open'); [...disputedOrders, ...resolvedDisputedOrders].forEach((o) => loadEvidence(o.id)); loadCaseStatus([...disputedOrders, ...resolvedDisputedOrders].map((o) => o.id)); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-amber-600 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>Dispute Queue ({disputedOrders.length})</button>)}
                        {isAdmin && (<button onClick={() => { openAdminSettings(); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>⚙️ Admin Settings</button>)}
                      </div>
                      <div className={`border-t ${cardBorder} mt-2 pt-2`}>
                        {isConnected ? (
                          <div className="space-y-1.5">
                            {isAdmin && <span className="inline-block px-2 py-1 bg-amber-400/20 text-amber-600 border border-amber-400/40 rounded-lg text-[11px] font-semibold mb-1">ADMIN</span>}
                            <button onClick={copyAddress} className={`w-full px-3 py-2 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} border ${cardBorder} rounded-lg text-xs font-mono flex items-center justify-center gap-2 transition-colors`}>
                              {addressCopied ? (<span>✓ Copied!</span>) : (<><span>{`${address?.slice(0, 6)}...${address?.slice(-4)}`}</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></>)}
                            </button>
                            <div className={`px-3 py-2.5 rounded-xl ${darkMode ? 'bg-gradient-to-br from-white/[0.06] to-white/[0.02]' : 'bg-gradient-to-br from-zinc-50 to-white'} border ${cardBorder} space-y-1.5`}>
                              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">B</span><span className={`text-[11px] font-medium ${subtleText}`}>tBNB</span></div><span className="text-xs font-mono font-semibold tabular-nums">{myBnbBalance ? Number(formatEther(myBnbBalance.value)).toFixed(4) : '...'}</span></div>
                              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">U</span><span className={`text-[11px] font-medium ${subtleText}`}>USDC</span></div><span className="text-xs font-mono font-semibold tabular-nums">{myUsdcBalance !== undefined ? (Number(myUsdcBalance) / 1e18).toFixed(2) : '...'}</span></div>
                              <div className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">U</span><span className={`text-[11px] font-medium ${subtleText}`}>USDT</span></div><span className="text-xs font-mono font-semibold tabular-nums">{myUsdtBalance !== undefined ? (Number(myUsdtBalance) / 1e18).toFixed(2) : '...'}</span></div>
                            </div>
                            {loginIdentity && (<div className={`px-3 pb-1 text-center text-[11px] ${subtleText} truncate`}>{loginIdentity}</div>)}
                            <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-amber-400/20 to-yellow-500/20 border border-amber-400/40 flex items-center justify-center gap-1.5">
                              <span className="text-sm">⭐</span>
                              <span className="text-sm font-bold text-amber-500">{myPoints}</span>
                              <span className={`text-xs ${subtleText}`}>points</span>
                            </div>
                            <button onClick={() => { setPurchasesOpen(true); setMenuOpen(false); Array.from(new Set(myPurchases.map((o) => getListingById(o.listingId)?.seller).filter((s): s is string => !!s))).forEach((s) => loadSellerReviews(s)); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                              📦 My Purchases {myPurchases.filter((o) => !o.released && !o.cancelled).length > 0 ? `(${myPurchases.filter((o) => !o.released && !o.cancelled).length})` : ''}
                            </button>
                            <button onClick={() => { setMessagesOpen(true); setMenuOpen(false); }} className={`relative w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                              💬 Messages
                              {allOrders.some((o) => { const l = getListingById(o.listingId); return (o.buyer.toLowerCase() === address?.toLowerCase() || (l && l.seller.toLowerCase() === address?.toLowerCase())) && hasUnreadChat(o.id); }) && (
                                <span className="absolute top-2.5 right-3 w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                              )}
                            </button>
                            <button onClick={() => { setReferralModalOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>🎁 Refer &amp; Earn</button>
                            <button onClick={() => { setSettingsOpen(true); setMenuOpen(false); }} className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>⚙️ Wallet Settings</button>
                            <button onClick={handleDisconnect} className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">Disconnect</button>
                          </div>
                        ) : (
                          <button onClick={() => { setMenuOpen(false); openWalletChoice(); }} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity">Login</button>
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
            <div className={`max-w-6xl mx-auto flex items-center ${inputBg} border ${cardBorder} rounded-full overflow-hidden mb-2`}>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search items..." className="flex-1 min-w-0 bg-transparent px-4 py-2.5 outline-none text-sm" />
              <div className="w-8 h-8 mr-1 rounded-full bg-gradient-to-r from-lime-400 to-sky-400 flex items-center justify-center text-zinc-900 shrink-0">🔍</div>
            </div>
            <div className="max-w-6xl mx-auto flex items-center gap-2 flex-wrap">
              <div className="relative">
                <button onClick={() => setSortMenuOpen((v) => !v)} className={`px-3 py-1.5 rounded-full border ${cardBorder} text-xs font-medium ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} flex items-center gap-1`}>
                  Sort: {sortOrder === 'newest' ? 'Newest' : sortOrder === 'price_low' ? 'Price: Low to High' : 'Price: High to Low'}
                  <span className="text-[10px]">▾</span>
                </button>
                {sortMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                    <div className={`absolute left-0 mt-2 w-48 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50`}>
                      <button onClick={() => { setSortOrder('newest'); setSortMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 text-sm font-medium ${sortOrder === 'newest' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>Newest</button>
                      <button
                        onClick={() => { if (filterAddress !== null) { setSortOrder('price_low'); setSortMenuOpen(false); } }}
                        disabled={filterAddress === null}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium ${filterAddress === null ? `${subtleText} cursor-not-allowed opacity-60` : sortOrder === 'price_low' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
                      >
                        Price: Low to High {filterAddress === null && <span className="block text-[10px] font-normal">Pick a currency first</span>}
                      </button>
                      <button
                        onClick={() => { if (filterAddress !== null) { setSortOrder('price_high'); setSortMenuOpen(false); } }}
                        disabled={filterAddress === null}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium ${filterAddress === null ? `${subtleText} cursor-not-allowed opacity-60` : sortOrder === 'price_high' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
                      >
                        Price: High to Low {filterAddress === null && <span className="block text-[10px] font-normal">Pick a currency first</span>}
                      </button>
                    </div>
                  </>
                )}
              </div>
              {filterAddress === null ? (
                <span className={`text-xs ${subtleText} italic`}>Pick a currency above to filter by price range</span>
              ) : (
                <>
                  <input type="number" min="0" step="0.0001" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder={`Min (${currencySymbol(filterAddress)})`} className={`w-28 ${inputBg} border ${cardBorder} rounded-full px-3 py-1.5 outline-none focus:border-lime-400 transition-colors text-xs`} />
                  <span className={`text-xs ${subtleText}`}>–</span>
                  <input type="number" min="0" step="0.0001" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder={`Max (${currencySymbol(filterAddress)})`} className={`w-28 ${inputBg} border ${cardBorder} rounded-full px-3 py-1.5 outline-none focus:border-lime-400 transition-colors text-xs`} />
                  {(minPrice || maxPrice) && (
                    <button onClick={() => { setMinPrice(''); setMaxPrice(''); }} className={`text-xs ${subtleText} underline`}>Clear</button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'shop' && adStrip.length > 0 && (
          <div className={`border-t ${cardBorder} py-3 relative`}>
            <div
              ref={adStripRef}
              onMouseEnter={() => { adStripPausedRef.current = true; }}
              onMouseLeave={() => { adStripPausedRef.current = false; }}
              onTouchStart={() => { adStripPausedRef.current = true; }}
              onTouchEnd={() => { setTimeout(() => { adStripPausedRef.current = false; }, 1500); }}
              className="flex gap-4 overflow-x-auto px-4 sm:px-8"
              style={{ scrollbarWidth: 'none' }}
            >
              {adStrip.map((listing, i) => {
                const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
                return (
                  <button key={`${listing.id}-${i}`} onClick={() => setQuickViewId(listing.id)} className={`flex items-center gap-4 ${cardBg} border ${cardBorder} rounded-2xl pr-5 py-2.5 shrink-0 hover:border-lime-400/60 transition-colors`}>
                    <img src={displayImage} alt={listing.name} className="w-24 h-24 rounded-xl object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                    <div className="text-left">
                      <p className="text-base font-medium truncate max-w-[200px]">{listing.name}</p>
                      <p className="text-sm font-mono text-lime-500">{(Number(listing.price) / 1e18).toString()} {currencySymbol(listing.paymentToken)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => scrollAdStrip('prev')}
              aria-label="Scroll sponsored items left"
              className={`absolute left-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center ${cardBg} border ${cardBorder} shadow-md hover:scale-105 active:scale-95 transition-transform`}
            >‹</button>
            <button
              onClick={() => scrollAdStrip('next')}
              aria-label="Scroll sponsored items right"
              className={`absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center ${cardBg} border ${cardBorder} shadow-md hover:scale-105 active:scale-95 transition-transform`}
            >›</button>
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

            <div className="flex gap-4 sm:gap-6 h-[82vh] sm:h-[86vh]">
              <div
                className="flex flex-col items-center gap-4 shrink-0 w-16 sm:w-20 overflow-y-auto pb-4 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
              >
                <button onClick={() => setViewCategory(ALL_CATEGORIES)} className="flex flex-col items-center gap-1.5">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl ${viewCategory === ALL_CATEGORIES ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder}`}`}>🗂️</div>
                  <span className={`text-xs font-medium ${viewCategory === ALL_CATEGORIES ? text : subtleText}`}>All</span>
                </button>
                {CATEGORIES.map((c) => (
                  <button key={c} onClick={() => setViewCategory(c)} className="flex flex-col items-center gap-1.5">
                    <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl ${viewCategory === c ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'bg-white/5' : 'bg-zinc-100'} border ${cardBorder}`}`}>{CATEGORY_ICONS[c]}</div>
                    <span className={`text-xs font-medium text-center leading-tight ${viewCategory === c ? text : subtleText}`}>{c}</span>
                  </button>
                ))}
              </div>

              <div
                className="flex-1 min-w-0 overflow-y-auto pb-4 pr-1 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: 'none' }}
              >
                {lCount === 0 ? (
                  <p className={subtleText}>No items listed yet.</p>
                ) : shopListings.length === 0 ? (
                  <p className={subtleText}>No items found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {shopListings.map((listing) => renderShopThumb(listing))}
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
                  Seller<br /><span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Dashboard.</span>
                </h2>
                <p className={`${subtleText} text-base sm:text-lg`}>Manage your listings, shipments, and sales.</p>
                {isConnected && sellerProfile && (
                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                    <button onClick={openSellerReg} className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-500 hover:text-sky-600">
                      🏪 {sellerProfile.shopName} <span className={`text-xs ${subtleText} font-normal`}>(edit)</span>
                    </button>
                    {address && (
                      <Link href={`/seller/${address}`} className="text-xs text-lime-600 hover:text-lime-700 underline">
                        View public storefront ↗
                      </Link>
                    )}
                  </div>
                )}
              </div>
              {isConnected && sellerProfile && (
                <div className="relative">
                  <button onClick={() => setSellPageMenuOpen((v) => !v)} className="relative flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_0_15px_rgba(163,230,53,0.3)]">
                    {sellSubTab === 'list' ? '📝 List an Item' : sellSubTab === 'fulfill' ? '📦 Orders to Fulfill' : sellSubTab === 'history' ? '📜 Sold History' : '📢 Sponsored Ads'}
                    <span className="text-xs">▾</span>
                    {myOrdersToFulfill.length > 0 && (
                      <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_6px_rgba(239,68,68,0.8)]">{myOrdersToFulfill.length}</span>
                    )}
                  </button>
                  {sellPageMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSellPageMenuOpen(false)} />
                      <div className={`absolute right-0 mt-2 w-56 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg overflow-hidden z-50`}>
                        <button onClick={() => { setSellSubTab('list'); setSellPageMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${sellSubTab === 'list' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>📝 List an Item</button>
                        <button onClick={() => { setSellSubTab('fulfill'); setSellPageMenuOpen(false); }} className={`relative w-full text-left px-4 py-3 text-sm font-medium ${sellSubTab === 'fulfill' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>
                          📦 Orders to Fulfill
                          {myOrdersToFulfill.length > 0 && (
                            <span className="absolute top-2.5 right-3 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-[0_0_6px_rgba(239,68,68,0.8)]">{myOrdersToFulfill.length}</span>
                          )}
                        </button>
                        <button onClick={() => { setSellSubTab('history'); setSellPageMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${sellSubTab === 'history' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>📜 Sold History {mySoldHistory.length > 0 ? `(${mySoldHistory.length})` : ''}</button>
                        <button onClick={() => { setSellSubTab('ads'); setSellPageMenuOpen(false); }} className={`w-full text-left px-4 py-3 text-sm font-medium ${sellSubTab === 'ads' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>📢 Sponsored Ads</button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {!isConnected ? (
              <div className={`${cardBg} rounded-3xl p-8 border ${cardBorder} text-center max-w-md`}>
                <p className={`${subtleText} mb-4`}>Connect your wallet to start selling.</p>
                <button onClick={openWalletChoice} className="px-6 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity">Login</button>
              </div>
            ) : !sellerProfile ? (
              <div className={`${cardBg} rounded-3xl p-8 border ${cardBorder} max-w-md`}>
                <h3 className="font-semibold text-lg mb-1">Become a Seller</h3>
                <p className={`text-sm ${subtleText} mb-5`}>A short, one-time setup — shop details, then a quick overview of how fees and escrow work.</p>
                <button onClick={() => { setSellerOnboardStep(1); setSellerOnboardOpen(true); }} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">Start Seller Registration</button>
              </div>
            ) : (
              <>
                {sellSubTab === 'list' && (
                  <div className={`mb-10 ${cardBg} rounded-3xl p-6 border ${cardBorder} max-w-lg`}>
                    <h3 className="font-semibold text-lg mb-4">List a New Item</h3>

                    <div className={`flex rounded-xl border ${cardBorder} p-1 mb-4`}>
                      <button onClick={() => setListMode('simple')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${listMode === 'simple' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>Simple</button>
                      <button onClick={() => setListMode('variants')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${listMode === 'variants' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>With Colors/Sizes</button>
                    </div>

                    <div className="space-y-3">
                      <div><label className={`text-xs ${subtleText} block mb-1`}>Item Name</label><input type="text" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g. Vintage Camera" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Photo</label>
                        <input type="text" value={itemImage} onChange={(e) => setItemImage(e.target.value)} placeholder="https://example.com/photo.jpg" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                        <label className={`mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                          {uploadingKey === 'simple' ? 'Uploading...' : '📷 Upload Photo'}
                          <input type="file" accept="image/*" className="hidden" disabled={uploadingKey === 'simple'} onChange={(e) => handleImageFileChange(e, setItemImage, 'simple')} />
                        </label>
                        {itemImage && (
                          <img src={itemImage} alt="Preview" className="mt-2 w-16 h-16 rounded-lg object-cover border border-zinc-300/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <p className={`text-[11px] ${subtleText} mt-1`}>Leave blank to use a placeholder image, or upload a photo, or paste a link</p>
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-2`}>Additional Photos &amp; Video (optional)</label>
                        {newListingMedia.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            {newListingMedia.map((m, i) => (
                              <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-300/30">
                                {m.type === 'image' ? (
                                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                                )}
                                <button
                                  type="button"
                                  onClick={() => setNewListingMedia((prev) => prev.filter((_, idx) => idx !== i))}
                                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[9px] flex items-center justify-center"
                                >✕</button>
                                {m.type === 'video' && (
                                  <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 rounded">VIDEO</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                            {uploadingKey === 'new-media-photo' ? 'Uploading...' : '📷 Add Photo'}
                            <input
                              type="file" accept="image/*" className="hidden" disabled={uploadingKey === 'new-media-photo'}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingKey('new-media-photo');
                                try {
                                  const url = await uploadImageToCloudinary(file);
                                  setNewListingMedia((prev) => [...prev, { url, type: 'image' }]);
                                } catch (err) { alert('Photo upload failed. Please try again.'); }
                                setUploadingKey(null);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                            {uploadingKey === 'new-media-video' ? 'Uploading...' : '🎥 Add Video'}
                            <input
                              type="file" accept="video/*" className="hidden" disabled={uploadingKey === 'new-media-video' || newListingMedia.some((m) => m.type === 'video')}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploadingKey('new-media-video');
                                try {
                                  const url = await uploadVideoToCloudinary(file);
                                  setNewListingMedia((prev) => [...prev, { url, type: 'video' }]);
                                } catch (err) { alert('Video upload failed. Please try again.'); }
                                setUploadingKey(null);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                        <p className={`text-[11px] ${subtleText} mt-1`}>Shown as a gallery on the item's page, alongside the main photo above. One video max for now.</p>
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-2`}>Specifications (optional)</label>
                        {newListingSpecs.length > 0 && (
                          <div className="space-y-2 mb-2">
                            {newListingSpecs.map((spec, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  type="text" placeholder="e.g. Material" value={spec.label}
                                  onChange={(e) => setNewListingSpecs((prev) => prev.map((s, idx) => idx === i ? { ...s, label: e.target.value } : s))}
                                  className={`w-24 shrink-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-xs outline-none focus:border-lime-400 transition-colors`}
                                />
                                <input
                                  type="text" placeholder="e.g. Cotton" value={spec.value}
                                  onChange={(e) => setNewListingSpecs((prev) => prev.map((s, idx) => idx === i ? { ...s, value: e.target.value } : s))}
                                  className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-xs outline-none focus:border-lime-400 transition-colors`}
                                />
                                <button type="button" onClick={() => setNewListingSpecs((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-red-500 text-xs px-1">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setNewListingSpecs((prev) => [...prev, { label: '', value: '' }])}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}
                        >
                          + Add Spec
                        </button>
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>Description (optional)</label>
                        <textarea
                          value={newListingDescription}
                          onChange={(e) => setNewListingDescription(e.target.value)}
                          placeholder="Tell buyers more about this item - fabric feel, fit, what's included, etc."
                          rows={4}
                          className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors resize-none`}
                        />
                      </div>
                      <div><label className={`text-xs ${subtleText} block mb-1`}>Category</label><select value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}>{CATEGORIES.map((c) => (<option key={c} value={c} style={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', color: darkMode ? '#ffffff' : '#18181b' }}>{c}</option>))}</select></div>
                      <div><label className={`text-xs ${subtleText} block mb-1`}>Currency</label><select value={itemCurrency} onChange={(e) => setItemCurrency(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}>{Object.keys(LIST_CURRENCIES).map((key) => (<option key={key} value={key} style={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', color: darkMode ? '#ffffff' : '#18181b' }}>{LIST_CURRENCIES[key].label}</option>))}</select></div>
                      <div><label className={`text-xs ${subtleText} block mb-1`}>Price (in {LIST_CURRENCIES[itemCurrency].symbol})</label><input type="number" step="0.0001" min="0" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="e.g. 0.01" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>

                      {listingFeeWei > BigInt(0) && (
                        <p className={`text-xs ${subtleText}`}>A listing fee of {formatEther(listingFeeWei)} tBNB applies to publish this item.</p>
                      )}

                      {listMode === 'simple' ? (
                        <>
                          <div><label className={`text-xs ${subtleText} block mb-1`}>Stock Quantity</label><input type="number" min="1" step="1" value={itemStock} onChange={(e) => setItemStock(e.target.value)} placeholder="e.g. 10" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
                          <button onClick={handleListSimple} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 active:scale-[0.985] transition-all disabled:opacity-50">
                            {isPending ? 'Confirm in wallet...' : 'List Item'}
                          </button>
                        </>
                      ) : (
                        <>
                          <div><label className={`text-xs ${subtleText} block mb-1`}>Colors (comma separated, optional if this item only has sizes)</label><input type="text" value={colorsInput} onChange={(e) => setColorsInput(e.target.value)} placeholder="e.g. Black, Grey, Navy" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
                          <div><label className={`text-xs ${subtleText} block mb-1`}>Sizes (comma separated, optional if this item only has colors)</label><input type="text" value={sizesInput} onChange={(e) => setSizesInput(e.target.value)} placeholder="e.g. S, M, L, XL" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>

                          {parsedColors.length > 0 && (
                            <div>
                              <label className={`text-xs ${subtleText} block mb-2`}>Photo per color (optional - falls back to the main image above)</label>
                              <div className="space-y-2">
                                {parsedColors.map((c) => (
                                  <div key={c} className="flex items-center gap-2">
                                    <span className={`text-xs ${subtleText} w-16 shrink-0`}>{c}</span>
                                    <input
                                      type="text"
                                      value={colorImagesInput[c] || ''}
                                      onChange={(e) => setColorImagesInput((prev) => ({ ...prev, [c]: e.target.value }))}
                                      placeholder="https://..."
                                      className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400 transition-colors`}
                                    />
                                    <label className={`shrink-0 px-2 py-2 rounded-lg border ${cardBorder} text-xs cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                                      {uploadingKey === `color-${c}` ? '...' : '📷'}
                                      <input type="file" accept="image/*" className="hidden" disabled={uploadingKey === `color-${c}`} onChange={(e) => handleImageFileChange(e, (url) => setColorImagesInput((prev) => ({ ...prev, [c]: url })), `color-${c}`)} />
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedColors.length > 0 && parsedSizes.length > 0 && (
                            <div>
                              <label className={`text-xs ${subtleText} block mb-2`}>Stock per color/size</label>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {parsedColors.map((c) => (
                                  <div key={c}>
                                    <p className="text-xs font-semibold mb-1">{c}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {parsedSizes.map((s) => {
                                        const key = `${c}|${s}`;
                                        return (
                                          <div key={key} className="flex items-center gap-2">
                                            <span className={`text-xs ${subtleText} w-10 shrink-0`}>{s}</span>
                                            <input
                                              type="number" min="0" step="1"
                                              value={stockMatrix[key] || ''}
                                              onChange={(e) => setStockMatrix((prev) => ({ ...prev, [key]: e.target.value }))}
                                              placeholder="0"
                                              className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-sm outline-none focus:border-lime-400 transition-colors`}
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {parsedColors.length > 0 && parsedSizes.length === 0 && (
                            <div>
                              <label className={`text-xs ${subtleText} block mb-2`}>Stock per color</label>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {parsedColors.map((c) => {
                                  const key = `${c}|${NO_VARIANT}`;
                                  return (
                                    <div key={key} className="flex items-center gap-2">
                                      <span className={`text-xs ${subtleText} w-16 shrink-0`}>{c}</span>
                                      <input
                                        type="number" min="0" step="1"
                                        value={stockMatrix[key] || ''}
                                        onChange={(e) => setStockMatrix((prev) => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="0"
                                        className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-sm outline-none focus:border-lime-400 transition-colors`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {parsedColors.length === 0 && parsedSizes.length > 0 && (
                            <div>
                              <label className={`text-xs ${subtleText} block mb-2`}>Stock per size</label>
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {parsedSizes.map((s) => {
                                  const key = `${NO_VARIANT}|${s}`;
                                  return (
                                    <div key={key} className="flex items-center gap-2">
                                      <span className={`text-xs ${subtleText} w-16 shrink-0`}>{s}</span>
                                      <input
                                        type="number" min="0" step="1"
                                        value={stockMatrix[key] || ''}
                                        onChange={(e) => setStockMatrix((prev) => ({ ...prev, [key]: e.target.value }))}
                                        placeholder="0"
                                        className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-sm outline-none focus:border-lime-400 transition-colors`}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <button onClick={handleListVariants} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 active:scale-[0.985] transition-all disabled:opacity-50">
                            {isPending ? 'Confirm in wallet...' : 'List Item'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {sellSubTab === 'list' && myListings.length > 0 && (
                  <div className="mb-10">
                    <h3 className="font-semibold text-lg mb-4">My Listings</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                      {myListings.map((listing) => {
                        const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
                        return (
                          <div key={listing.id} className={`${cardBg} rounded-3xl overflow-hidden border ${cardBorder}`}>
                            <div className={`w-full aspect-[4/3] ${darkMode ? 'bg-white/5' : 'bg-zinc-100'} overflow-hidden`}>
                              <img src={displayImage} alt={listing.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                            </div>
                            <div className="p-4">
                              <h4 className="font-semibold mb-1">{listing.name}</h4>
                              <p className={`text-sm font-mono text-lime-500 mb-1`}>{(Number(listing.price) / 1e18).toString()} {currencySymbol(listing.paymentToken)}</p>
                              <p className={`text-xs ${subtleText} mb-3`}>{listing.hasVariants ? `${listing.colors.length} colors, ${listing.sizes.length} sizes` : `${listing.simpleStock.toString()} in stock`}</p>
                              <div className="flex gap-2">
                                <button onClick={() => openEditListing(listing)} className={`flex-1 py-2 text-xs font-medium transition-colors border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>Edit</button>
                                <button onClick={() => call('delistItem', [BigInt(listing.id)])} disabled={isPending} className="flex-1 py-2 text-red-500 hover:text-red-600 text-xs font-medium transition-colors border border-red-500/30 rounded-xl">Remove</button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sellSubTab === 'ads' && isConnected && sellerProfile && (
                  <div className={`mb-10 ${cardBg} rounded-3xl p-6 border ${cardBorder} max-w-lg`}>
                    <h3 className="font-semibold text-lg mb-1">Sponsored Ads</h3>
                    {!mySubscriptionActive ? (
                      <>
                        <p className={`text-sm ${subtleText} mb-4`}>Subscribe to feature up to 3 of your items in the Sponsored strip at the top of the shop for {adSubscriptionDurationSeconds ? Math.round(adSubscriptionDurationSeconds / 86400) : '...'} days.</p>
                        <button onClick={handleSubscribeToAds} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                          {isPending ? 'Confirm in wallet...' : `Subscribe for ${formatEther(adSubscriptionFeeWei)} tBNB`}
                        </button>
                      </>
                    ) : (
                      <>
                        <p className={`text-sm ${subtleText} mb-4`}>
                          Your ad subscription is active until {new Date(mySubscriptionExpiry * 1000).toLocaleDateString()}. Pick up to 3 of your items to feature — you can change this selection as often as you like while subscribed.
                        </p>
                        {myListings.length === 0 ? (
                          <p className={`text-sm ${subtleText} mb-4`}>List an item first to feature it.</p>
                        ) : (
                          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto pr-1">
                            {myListings.map((listing) => {
                              const checked = selectedFeaturedIds.includes(listing.id);
                              return (
                                <label key={listing.id} className={`flex items-center gap-3 p-2 rounded-xl border ${cardBorder} cursor-pointer ${checked ? 'bg-lime-400/10 border-lime-400/40' : ''}`}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleFeaturedSelection(listing.id)} className="shrink-0" />
                                  <span className="text-sm truncate">{listing.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <button onClick={saveFeaturedSelection} disabled={isPending} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                          {isPending ? 'Confirm in wallet...' : 'Save Featured Selection'}
                        </button>
                        <button onClick={handleSubscribeToAds} disabled={isPending} className={`w-full mt-2 py-2 text-xs font-medium transition-colors border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                          Extend subscription (+{adSubscriptionDurationSeconds ? Math.round(adSubscriptionDurationSeconds / 86400) : '...'} days for {formatEther(adSubscriptionFeeWei)} tBNB)
                        </button>
                      </>
                    )}
                  </div>
                )}

                {sellSubTab === 'fulfill' && (
                  <div>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="font-semibold text-lg">Orders to Fulfill</h3>
                      {myOrdersToFulfill.length > 0 && !sellerShipAuth && (
                        <button onClick={unlockSellerShipping} disabled={unlockingShipInfo} className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                          {unlockingShipInfo ? 'Confirm in wallet...' : '🔒 Unlock Shipping Info'}
                        </button>
                      )}
                    </div>
                    {myOrdersToFulfill.length === 0 ? (
                      <p className={subtleText}>No orders currently need action.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {myOrdersToFulfill.map((order) => renderOrderCard(order, 'seller'))}
                      </div>
                    )}
                  </div>
                )}

                {sellSubTab === 'history' && (
                  <div>
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="font-semibold text-lg">Sold History</h3>
                      {hiddenOrderIds.size > 0 && (
                        <button onClick={unhideAllOrders} className={`text-xs ${subtleText} underline`}>
                          {hiddenOrderIds.size} hidden — show all
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-5 flex-wrap">
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>From</label>
                        <input type="date" value={historyFromDate} onChange={(e) => setHistoryFromDate(e.target.value)} className={`${inputBg} border ${cardBorder} rounded-xl px-3 py-2 outline-none focus:border-lime-400 transition-colors text-sm`} />
                      </div>
                      <div>
                        <label className={`text-xs ${subtleText} block mb-1`}>To</label>
                        <input type="date" value={historyToDate} onChange={(e) => setHistoryToDate(e.target.value)} className={`${inputBg} border ${cardBorder} rounded-xl px-3 py-2 outline-none focus:border-lime-400 transition-colors text-sm`} />
                      </div>
                      {(historyFromDate || historyToDate) && (
                        <button onClick={() => { setHistoryFromDate(''); setHistoryToDate(''); }} className={`text-xs ${subtleText} underline self-end mb-2`}>Clear dates</button>
                      )}
                    </div>
                    {mySoldHistory.length === 0 ? (
                      <p className={subtleText}>{historyFromDate || historyToDate ? 'No sold orders in that date range.' : 'No completed or cancelled orders yet.'}</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {mySoldHistory.map((order) => (
                          <div key={order.id}>
                            {renderOrderCard(order, 'seller')}
                            <button onClick={() => hideOrderFromHistory(order.id)} className={`mt-2 w-full py-1.5 text-xs font-medium border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} transition-colors`}>
                              Hide from history
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="mb-10">
              <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-3">Platform<br /><span className="bg-gradient-to-r from-lime-500 via-emerald-400 to-sky-500 bg-clip-text text-transparent">Analytics.</span></h2>
              <p className={`${subtleText} text-base sm:text-lg`}>Live stats pulled directly from the smart contract.</p>
            </div>

            <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} mb-6`}>
              <h3 className="font-semibold text-lg mb-4">Marketplace Activity</h3>
              <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsStats} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: darkMode ? '#a1a1aa' : '#71717a' }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: darkMode ? '#a1a1aa' : '#71717a' }} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 12, fontSize: 12 }} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {analyticsStats.map((stat) => (<Cell key={stat.label} fill={stat.color} />))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
              {analyticsStats.map((stat) => (
                <div key={stat.label} className={`${cardBg} rounded-3xl p-6 border ${cardBorder}`}>
                  <p className={`text-xs ${subtleText} uppercase tracking-wide mb-2`}>{stat.label}</p>
                  <p className="text-3xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                </div>
              ))}
            </div>
            <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} mb-10`}>
              <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                <h3 className="font-semibold text-lg">Site Visits &amp; New Accounts</h3>
                {!siteAnalytics && (
                  <button onClick={loadSiteAnalytics} disabled={siteAnalyticsLoading} className="px-3 py-1.5 text-xs font-semibold bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50">
                    {siteAnalyticsLoading ? 'Loading...' : 'Load Chart'}
                  </button>
                )}
              </div>
              <p className={`text-xs ${subtleText} mb-4`}>Last 30 days · Visits count anyone who loads the site, connected or not. Accounts count each wallet's first-ever connection.</p>
              {siteAnalytics ? (
                <>
                  <div className="flex gap-6 mb-4">
                    <div><p className={`text-xs ${subtleText}`}>Total visits</p><p className="text-2xl font-bold">{siteAnalytics.totalVisits}</p></div>
                    <div><p className={`text-xs ${subtleText}`}>Total accounts</p><p className="text-2xl font-bold">{siteAnalytics.totalAccounts}</p></div>
                  </div>
                  <div className="w-full h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={siteAnalytics.visitsByDay.map((v, i) => ({ date: v.date.slice(5), visits: v.count, accounts: siteAnalytics.accountsByDay[i]?.count || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} />
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: darkMode ? '#a1a1aa' : '#71717a' }} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: darkMode ? '#a1a1aa' : '#71717a' }} />
                        <Tooltip contentStyle={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, borderRadius: 12, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="visits" name="Visits" stroke="#38bdf8" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="accounts" name="New Accounts" stroke="#a3e635" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className={`text-sm ${subtleText} py-6 text-center`}>{siteAnalyticsLoading ? 'Loading...' : 'Click "Load Chart" to view visit and account trends.'}</p>
              )}
            </div>
            <div className={`${cardBg} rounded-3xl p-6 border ${cardBorder} max-w-md`}>
              <h3 className="font-semibold text-lg mb-1">Platform Fee Wallet</h3>
              <p className={`text-xs ${subtleText} mb-4 font-mono`}>
                {feeWalletAddress ? `${(feeWalletAddress as string).slice(0, 6)}...${(feeWalletAddress as string).slice(-4)}` : 'Loading...'} — {buyerFeePercent ? Number(buyerFeePercent) : '—'}% buyer fee + {sellerFeePercent ? Number(sellerFeePercent) : '—'}% seller fee
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center"><span className={`text-sm ${subtleText}`}>tBNB collected</span><span className="font-mono font-semibold">{feeWalletBnbBalance?.value ? formatEther(feeWalletBnbBalance.value).slice(0, 8) : '0'}</span></div>
                <div className="flex justify-between items-center"><span className={`text-sm ${subtleText}`}>USDC collected</span><span className="font-mono font-semibold">{feeWalletUsdcBalance ? (Number(feeWalletUsdcBalance) / 1e18).toFixed(4) : '0'}</span></div>
                <div className="flex justify-between items-center"><span className={`text-sm ${subtleText}`}>USDT collected</span><span className="font-mono font-semibold">{feeWalletUsdtBalance ? (Number(feeWalletUsdtBalance) / 1e18).toFixed(4) : '0'}</span></div>
              </div>
            </div>
          </>
        )}
      </div>

      <footer className={`border-t ${cardBorder} mt-12`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <OpenSpaceBrand imgClassName="h-8 w-auto" textClassName="text-lg" />
          <p className={`text-xs ${subtleText}`}>Running on BNB Smart Chain Testnet</p>
        </div>
      </footer>

      {sellerOnboardOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[80] p-4">
          <div className={`${cardBg} rounded-3xl w-full max-w-lg border ${cardBorder} overflow-hidden max-h-[92vh] flex flex-col`}>
            <div className={`px-6 pt-6 pb-4 border-b ${cardBorder}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-xl">Become a Seller</h3>
                <button onClick={() => { setSellerOnboardOpen(false); setSellerOnboardStep(1); }} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((s) => (
                  <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= sellerOnboardStep ? 'bg-gradient-to-r from-lime-400 to-sky-400' : darkMode ? 'bg-white/10' : 'bg-zinc-100'}`} />
                ))}
              </div>
            </div>

            <div className="px-6 py-6 overflow-y-auto flex-1">
              {sellerOnboardStep === 1 && (
                <div>
                  <div className="text-4xl mb-4">🏪</div>
                  <h4 className="font-semibold text-lg mb-2">Welcome, future seller</h4>
                  <p className={`text-sm ${subtleText} mb-5`}>OpenSpace is built to make selling simple and fair. Here's what that means for you:</p>
                  <div className="space-y-3 mb-2">
                    <div className={`p-3 rounded-xl border ${cardBorder} flex items-start gap-3`}>
                      <span className="text-lg shrink-0">🔒</span>
                      <div><p className="text-sm font-medium">Escrow-protected sales</p><p className={`text-xs ${subtleText}`}>Buyer funds are locked on-chain the moment they check out — no chargebacks, no surprises.</p></div>
                    </div>
                    <div className={`p-3 rounded-xl border ${cardBorder} flex items-start gap-3`}>
                      <span className="text-lg shrink-0">⚡</span>
                      <div><p className="text-sm font-medium">Fast, direct payouts</p><p className={`text-xs ${subtleText}`}>Funds go straight to your wallet once a sale completes — no multi-day holding period.</p></div>
                    </div>
                    <div className={`p-3 rounded-xl border ${cardBorder} flex items-start gap-3`}>
                      <span className="text-lg shrink-0">💰</span>
                      <div><p className="text-sm font-medium">Low, transparent fees</p><p className={`text-xs ${subtleText}`}>Just a small seller fee per sale — visible on-chain, never hidden.</p></div>
                    </div>
                  </div>
                </div>
              )}

              {sellerOnboardStep === 2 && (
                <div>
                  <h4 className="font-semibold text-lg mb-1">Set up your shop</h4>
                  <p className={`text-sm ${subtleText} mb-5`}>A name and a short bio — this only takes a moment, and you only do it once.</p>
                  <div className="space-y-3">
                    <div><label className={`text-xs ${subtleText} block mb-1`}>Shop Name</label><input type="text" value={shopNameInput} onChange={(e) => setShopNameInput(e.target.value)} placeholder="e.g. Kemi's Closet" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
                    <div><label className={`text-xs ${subtleText} block mb-1`}>Short Bio (optional)</label><textarea value={shopBioInput} onChange={(e) => setShopBioInput(e.target.value)} placeholder="What do you sell? What makes your shop worth checking out?" rows={3} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors resize-none`} /></div>
                  </div>
                </div>
              )}

              {sellerOnboardStep === 3 && (
                <div>
                  <h4 className="font-semibold text-lg mb-1">Fees &amp; how payouts work</h4>
                  <p className={`text-sm ${subtleText} mb-4`}>Quick overview before you start listing:</p>
                  <div className={`rounded-xl border ${cardBorder} divide-y ${darkMode ? 'divide-white/10' : 'divide-zinc-100'} mb-4`}>
                    <div className="flex justify-between px-4 py-3 text-sm"><span className={subtleText}>Seller fee per sale</span><span className="font-semibold">{sellerFeePercent ? Number(sellerFeePercent) : '—'}%</span></div>
                    <div className="flex justify-between px-4 py-3 text-sm"><span className={subtleText}>Listing fee (per item)</span><span className="font-semibold">{formatEther(listingFeeWei)} tBNB</span></div>
                    <div className="flex justify-between px-4 py-3 text-sm"><span className={subtleText}>When you get paid</span><span className="font-semibold text-right">On buyer confirmation, or automatically after {releaseWindow ? Math.round(Number(releaseWindow) / 60) : '5'} min</span></div>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={sellerOnboardAgreed} onChange={(e) => setSellerOnboardAgreed(e.target.checked)} className="mt-0.5 shrink-0" />
                    <span className={`text-xs ${subtleText}`}>I understand fees are charged on-chain per sale/listing, and that only I control my shop's funds and inventory.</span>
                  </label>
                </div>
              )}

              {sellerOnboardStep === 4 && (
                <div className="text-center py-4">
                  <div className="text-5xl mb-4">🎉</div>
                  <h4 className="font-semibold text-xl mb-2">You're almost a seller!</h4>
                  <p className={`text-sm ${subtleText} mb-1`}>Shop: <span className="font-medium">{shopNameInput || '—'}</span></p>
                  <p className={`text-sm ${subtleText}`}>Tap below to confirm and start listing your first item.</p>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 border-t ${cardBorder} flex gap-2`}>
              {sellerOnboardStep > 1 && (
                <button onClick={() => setSellerOnboardStep((s) => s - 1)} className={`px-4 py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Back</button>
              )}
              {sellerOnboardStep < 4 ? (
                <button
                  onClick={() => {
                    if (sellerOnboardStep === 2 && !shopNameInput.trim()) { alert('Please enter a shop name'); return; }
                    if (sellerOnboardStep === 3 && !sellerOnboardAgreed) { alert('Please confirm you understand the fee terms'); return; }
                    setSellerOnboardStep((s) => s + 1);
                  }}
                  className="flex-1 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl font-semibold hover:opacity-90 transition-all"
                >
                  Continue
                </button>
              ) : (
                <button onClick={saveSellerProfile} className="flex-1 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl font-semibold hover:opacity-90 transition-all">Confirm &amp; Create My Shop</button>
              )}
            </div>
          </div>
        </div>
      )}

      {sellerRegOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setSellerRegOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">{sellerProfile ? 'Edit Shop Profile' : 'Set Up Your Shop'}</h3><button onClick={() => setSellerRegOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button></div>
            <div className="space-y-3 mb-5">
              <div><label className={`text-xs ${subtleText} block mb-1`}>Shop Name</label><input type="text" value={shopNameInput} onChange={(e) => setShopNameInput(e.target.value)} placeholder="e.g. Kemi's Closet" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Short Bio (optional)</label><textarea value={shopBioInput} onChange={(e) => setShopBioInput(e.target.value)} placeholder="What do you sell?" rows={3} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors resize-none`} /></div>
            </div>
            <button onClick={saveSellerProfile} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">Save Changes</button>
          </div>
        </div>
      )}

      {editingListingId !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setEditingListingId(null)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Edit Listing</h3>
              <button onClick={() => setEditingListingId(null)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>
            <div className="space-y-3 mb-5">
              <div><label className={`text-xs ${subtleText} block mb-1`}>Item Name</label><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Photo</label>
                <input type="text" value={editImage} onChange={(e) => setEditImage(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                <label className={`mt-2 inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                  {uploadingKey === 'edit' ? 'Uploading...' : '📷 Upload New Photo'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingKey === 'edit'} onChange={(e) => handleImageFileChange(e, setEditImage, 'edit')} />
                </label>
                {editImage && (
                  <img src={editImage} alt="Preview" className="mt-2 w-16 h-16 rounded-lg object-cover border border-zinc-300/30" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                )}
              </div>
              <div>
                <label className={`text-xs ${subtleText} block mb-2`}>Additional Photos &amp; Video</label>
                {!editListingMediaLoaded ? (
                  <p className={`text-xs ${subtleText}`}>Loading...</p>
                ) : (
                  <>
                    {editListingMedia.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {editListingMedia.map((m, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-300/30">
                            {m.type === 'image' ? (
                              <img src={m.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                            )}
                            <button
                              type="button"
                              onClick={() => setEditListingMedia((prev) => prev.filter((_, idx) => idx !== i))}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[9px] flex items-center justify-center"
                            >✕</button>
                            {m.type === 'video' && (
                              <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 rounded">VIDEO</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                        {uploadingKey === 'edit-media-photo' ? 'Uploading...' : '📷 Add Photo'}
                        <input
                          type="file" accept="image/*" className="hidden" disabled={uploadingKey === 'edit-media-photo'}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingKey('edit-media-photo');
                            try {
                              const url = await uploadImageToCloudinary(file);
                              setEditListingMedia((prev) => [...prev, { url, type: 'image' }]);
                            } catch (err) { alert('Photo upload failed. Please try again.'); }
                            setUploadingKey(null);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                        {uploadingKey === 'edit-media-video' ? 'Uploading...' : '🎥 Add Video'}
                        <input
                          type="file" accept="video/*" className="hidden" disabled={uploadingKey === 'edit-media-video' || editListingMedia.some((m) => m.type === 'video')}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingKey('edit-media-video');
                            try {
                              const url = await uploadVideoToCloudinary(file);
                              setEditListingMedia((prev) => [...prev, { url, type: 'video' }]);
                            } catch (err) { alert('Video upload failed. Please try again.'); }
                            setUploadingKey(null);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className={`text-xs ${subtleText} block mb-2`}>Specifications</label>
                {!editListingDetailsLoaded ? (
                  <p className={`text-xs ${subtleText}`}>Loading...</p>
                ) : (
                  <>
                    {editListingSpecs.length > 0 && (
                      <div className="space-y-2 mb-2">
                        {editListingSpecs.map((spec, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input
                              type="text" placeholder="e.g. Material" value={spec.label}
                              onChange={(e) => setEditListingSpecs((prev) => prev.map((s, idx) => idx === i ? { ...s, label: e.target.value } : s))}
                              className={`w-24 shrink-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-xs outline-none focus:border-lime-400 transition-colors`}
                            />
                            <input
                              type="text" placeholder="e.g. Cotton" value={spec.value}
                              onChange={(e) => setEditListingSpecs((prev) => prev.map((s, idx) => idx === i ? { ...s, value: e.target.value } : s))}
                              className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-xs outline-none focus:border-lime-400 transition-colors`}
                            />
                            <button type="button" onClick={() => setEditListingSpecs((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-red-500 text-xs px-1">✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditListingSpecs((prev) => [...prev, { label: '', value: '' }])}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}
                    >
                      + Add Spec
                    </button>
                  </>
                )}
              </div>
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Description</label>
                <textarea
                  value={editListingDescription}
                  onChange={(e) => setEditListingDescription(e.target.value)}
                  placeholder="Tell buyers more about this item - fabric feel, fit, what's included, etc."
                  rows={4}
                  className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors resize-none`}
                />
              </div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Category</label><select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}>{CATEGORIES.map((c) => (<option key={c} value={c} style={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', color: darkMode ? '#ffffff' : '#18181b' }}>{c}</option>))}</select></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Price</label><input type="number" step="0.0001" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              {editingListingId !== null && !getListingById(editingListingId)?.hasVariants && (
                <div><label className={`text-xs ${subtleText} block mb-1`}>Stock Quantity</label><input type="number" min="0" step="1" value={editStock} onChange={(e) => setEditStock(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              )}
              {editingListingId !== null && getListingById(editingListingId)?.hasVariants && (
                <>
                  <div className={`p-3 rounded-xl border ${cardBorder} ${darkMode ? 'bg-white/5' : 'bg-zinc-50'}`}>
                    <p className={`text-xs ${subtleText}`}>
                      You can update stock and photos for the colors/sizes already on this listing below. Adding a brand-new color or size isn't supported once an item is listed — the contract fixes the variant list at creation. To add new variants, remove this listing and create a new one with the full set of colors/sizes you want.
                    </p>
                  </div>
                  <div>
                    <label className={`text-xs ${subtleText} block mb-2`}>Stock per color/size</label>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {getListingById(editingListingId)!.colors.map((c) => (
                        <div key={c}>
                          <p className="text-xs font-semibold mb-1">{c}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {getListingById(editingListingId)!.sizes.map((s) => {
                              const key = `${c}|${s}`;
                              return (
                                <div key={key} className="flex items-center gap-2">
                                  <span className={`text-xs ${subtleText} w-10 shrink-0`}>{s}</span>
                                  <input
                                    type="number" min="0" step="1"
                                    value={getEditVariantStockValue(c, s)}
                                    onChange={(e) => setEditVariantStock((prev) => ({ ...prev, [key]: e.target.value }))}
                                    className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-2 py-1.5 text-sm outline-none focus:border-lime-400 transition-colors`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs ${subtleText} block mb-2`}>Photo per color (optional - falls back to the main image above)</label>
                    <div className="space-y-2">
                      {getListingById(editingListingId)!.colors.map((c) => (
                        <div key={c} className="flex items-center gap-2">
                          <span className={`text-xs ${subtleText} w-16 shrink-0`}>{c}</span>
                          <input
                            type="text"
                            value={getEditColorImageValue(c)}
                            onChange={(e) => setEditColorImages((prev) => ({ ...prev, [c]: e.target.value }))}
                            placeholder="https://..."
                            className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-lg px-3 py-2 text-sm outline-none focus:border-lime-400 transition-colors`}
                          />
                          <label className={`shrink-0 px-2 py-2 rounded-lg border ${cardBorder} text-xs cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                            {uploadingKey === `edit-color-${c}` ? '...' : '📷'}
                            <input type="file" accept="image/*" className="hidden" disabled={uploadingKey === `edit-color-${c}`} onChange={(e) => handleImageFileChange(e, (url) => setEditColorImages((prev) => ({ ...prev, [c]: url })), `edit-color-${c}`)} />
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <button onClick={saveEditListing} disabled={isPending || editQueueRunning || savingListingMedia || savingListingDetails} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {editQueueRunning
                ? `Confirm in wallet... (${editQueueTotal - editQueue.length + 1}/${editQueueTotal})`
                : isPending ? 'Confirm in wallet...' : (savingListingMedia || savingListingDetails) ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {purchasesOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setPurchasesOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">My Purchases</h3><button onClick={() => setPurchasesOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button></div>
            {myPurchases.length === 0 ? (<p className={`${subtleText} text-sm py-8 text-center`}>You haven't bought anything yet.</p>) : (<div className="space-y-4">{myPurchases.map((order) => renderOrderCard(order, 'buyer'))}</div>)}
          </div>
        </div>
      )}

      {messagesOpen && (() => {
        // Every order this wallet is part of (as buyer or seller) is a
        // potential conversation - exactly the same set the background
        // unread-checker already tracks, just displayed as a list here
        // instead of individual buttons scattered across order cards.
        const myConversations = allOrders
          .filter((o) => {
            const listing = getListingById(o.listingId);
            return o.buyer.toLowerCase() === address?.toLowerCase() || (listing && listing.seller.toLowerCase() === address?.toLowerCase());
          })
          .map((o) => {
            const listing = getListingById(o.listingId);
            const isBuyerHere = o.buyer.toLowerCase() === address?.toLowerCase();
            const otherParty = isBuyerHere ? (listing?.seller || '') : o.buyer;
            return { order: o, listing, isBuyerHere, otherParty, lastActivity: chatActivityMap[o.id] || null, unread: hasUnreadChat(o.id) };
          })
          .filter((c) => c.listing)
          .sort((a, b) => {
            // Conversations with real activity float to the top, most
            // recent first; ones with no messages yet sit below, most
            // recently purchased first.
            if (a.lastActivity && b.lastActivity) return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
            if (a.lastActivity) return -1;
            if (b.lastActivity) return 1;
            return Number(b.order.purchaseTime) - Number(a.order.purchaseTime);
          });
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setMessagesOpen(false)}>
            <div className={`${cardBg} rounded-3xl w-full max-w-md border ${cardBorder} max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className={`px-6 py-4 border-b ${cardBorder} flex items-center justify-between`}>
                <h3 className="font-semibold text-lg">Messages</h3>
                <button onClick={() => setMessagesOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center shrink-0`}>✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {myConversations.length === 0 ? (
                  <p className={`${subtleText} text-sm py-12 text-center px-6`}>No conversations yet - buy or sell something to start one.</p>
                ) : (
                  myConversations.map(({ order, listing, isBuyerHere, otherParty, lastActivity, unread }) => {
                    const displayImage = listing!.imageUrl && listing!.imageUrl.trim() !== '' ? listing!.imageUrl : FALLBACK_IMAGE;
                    return (
                      <button
                        key={order.id}
                        onClick={() => {
                          setMessagesOpen(false);
                          setChatUnavailable(null);
                          setChatModalOrderId(order.id);
                          loadChatMessages(order.id, chatMessagesMap[order.id] !== undefined);
                          markChatSeen(order.id);
                        }}
                        className={`w-full flex items-center gap-3 px-6 py-3 border-b ${cardBorder} last:border-b-0 text-left ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} transition-colors`}
                      >
                        <img src={displayImage} alt={listing!.name} className="w-12 h-12 rounded-xl object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{listing!.name}</p>
                            {unread && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />}
                          </div>
                          <p className={`text-xs ${subtleText} truncate`}>
                            {isBuyerHere ? 'Seller' : 'Buyer'}: {otherParty.slice(0, 6)}...{otherParty.slice(-4)}
                          </p>
                        </div>
                        <span className={`text-[10px] ${subtleText} shrink-0`}>
                          {lastActivity ? new Date(lastActivity).toLocaleDateString() : 'No messages yet'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {referralModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setReferralModalOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">🎁 Refer &amp; Earn</h3>
              <button onClick={() => setReferralModalOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>
            <p className={`text-sm ${subtleText} mb-5`}>
              Share your link. When someone you invite buys or lists their first item, you get <span className="font-semibold text-amber-500">{referralPointsData !== undefined ? Number(referralPointsData) : '10'} points</span>, and they get a <span className="font-semibold text-amber-500">{refereeBonusPointsData !== undefined ? Number(refereeBonusPointsData) : '5'}-point</span> bonus on top of what they already earn.
            </p>
            <div className={`p-3 rounded-xl border ${cardBorder} ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} mb-3`}>
              <p className={`text-[11px] ${subtleText} uppercase tracking-wide mb-1 font-semibold`}>Your referral link</p>
              <p className="text-xs font-mono break-all">{myReferralLink || 'Connect your wallet to get your link'}</p>
            </div>
            <button onClick={copyReferralLink} disabled={!myReferralLink} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
              {referralLinkCopied ? '✓ Copied!' : 'Copy My Referral Link'}
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setSettingsOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-sm border ${cardBorder}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">Wallet Settings</h3><button onClick={() => setSettingsOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button></div>
            <div className="space-y-4">
              <div><label className={`text-xs ${subtleText} block mb-1`}>Wallet Address</label><button onClick={copySettingsAddress} className={`w-full px-3 py-3 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-50 hover:bg-zinc-100'} border ${cardBorder} rounded-xl text-xs font-mono text-left break-all transition-colors`}>{settingsAddressCopied ? '✓ Copied to clipboard!' : address}</button></div>
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Balance</label>
                <div className={`px-3 py-3 ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} rounded-xl text-sm font-mono space-y-1`}>
                  <div className="flex justify-between"><span>tBNB</span><span>{myBnbBalance ? Number(formatEther(myBnbBalance.value)).toFixed(4) : 'Loading...'}</span></div>
                  <div className="flex justify-between"><span>USDC</span><span>{myUsdcBalance !== undefined ? (Number(myUsdcBalance) / 1e18).toFixed(4) : 'Loading...'}</span></div>
                  <div className="flex justify-between"><span>USDT</span><span>{myUsdtBalance !== undefined ? (Number(myUsdtBalance) / 1e18).toFixed(4) : 'Loading...'}</span></div>
                </div>
                <p className={`text-[11px] ${subtleText} mt-1`}>Need funds? Get free test tBNB (and USDC/USDT) at testnet.bnbchain.org/faucet-smart</p>
              </div>
              <div className={`border-t ${cardBorder} pt-4`}>
                <p className="text-sm font-medium mb-1">🔔 Order Notifications</p>
                <p className={`text-xs ${subtleText} mb-2`}>{pushEnabled ? 'Push notifications are on - you\'ll be alerted the moment someone buys from you, even with the tab closed.' : 'Get notified the moment someone buys from you, even with the tab closed.'}</p>
                {pushEnabled ? (
                  <button onClick={disablePushNotifications} className={`w-full py-2 text-sm font-medium border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>Turn Off Notifications</button>
                ) : (
                  <button onClick={enablePushNotifications} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">Enable Notifications</button>
                )}
              </div>
              <div className={`border-t ${cardBorder} pt-4`}>
                {hasEmbeddedWallet ? (
                  <>
                    <button onClick={() => exportWallet()} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity">🔐 Back Up Wallet</button>
                    <p className={`text-[11px] ${subtleText} mt-2`}>This opens a secure screen where you can view and copy your private key or recovery phrase. Never share this with anyone.</p>
                  </>
                ) : (
                  <p className={`text-xs ${subtleText}`}>You're connected with an external wallet (like MetaMask). Your recovery phrase and backup are managed directly in that wallet app, not here.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {quickViewListing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[65] p-0 sm:p-4" onClick={() => setQuickViewId(null)}>
          {/* Three zones: image (left) | scrollable info (middle) | action
              sidebar (right). Stacks into one flowing column on mobile,
              where the whole popup scrolls as a single piece - matching how
              it worked before. From the "md" breakpoint up, it becomes a
              real 3-column layout and ONLY the middle column scrolls, while
              the photo and the sidebar stay put - this is the shape future
              phases (video gallery, specs, reviews, seller card) will get
              built into. */}
          <div
            className={`${cardBg} w-full h-full sm:h-auto sm:max-h-[92vh] md:h-[85vh] md:max-h-[85vh] sm:rounded-3xl border-0 sm:border ${cardBorder} overflow-y-auto md:overflow-hidden md:max-w-5xl flex flex-col md:flex-row`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ---------- LEFT: thumbnail rail + main image/video ---------- */}
            {/* aspect-square lives on this outer row (mobile only - md+
                uses the popup's own fixed height instead), so both the rail
                and the main display share one guaranteed height between
                them, instead of each guessing its own - this is what was
                causing thumbnails to get cut off before. */}
            <div className="w-full md:w-[380px] md:shrink-0 aspect-square md:aspect-auto md:h-full flex flex-row">
              {/* Thumbnail rail - the on-chain main/color photo first, then
                  any extra photos/video the seller uploaded. Always shown,
                  even with nothing extra to switch to, so the layout stays
                  consistent instead of jumping around depending on whether
                  a given item happens to have extra media. */}
              <div className={`w-14 h-full shrink-0 flex flex-col gap-1.5 p-1.5 overflow-y-auto [&::-webkit-scrollbar]:hidden ${darkMode ? 'bg-white/5' : 'bg-zinc-100'}`} style={{ scrollbarWidth: 'none' }}>
                <button
                    onClick={() => setQvSelectedMediaIndex(null)}
                    className={`w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 ${qvSelectedMediaIndex === null ? 'border-lime-400' : 'border-transparent'}`}
                  >
                    <img src={getQvDisplayImage()} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                  </button>
                  {qvMediaList.map((m, i) => (
                    <button
                      key={i}
                      onClick={() => setQvSelectedMediaIndex(i)}
                      className={`relative w-11 h-11 rounded-lg overflow-hidden border-2 shrink-0 ${qvSelectedMediaIndex === i ? 'border-lime-400' : 'border-transparent'}`}
                    >
                      {m.type === 'image' ? (
                        <img src={m.url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                      ) : (
                        <>
                          <video src={m.url} className="w-full h-full object-cover" muted playsInline />
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <span className="w-4 h-4 rounded-full bg-white/90 flex items-center justify-center text-black text-[8px]">▶</span>
                          </span>
                        </>
                      )}
                    </button>
                  ))}
                  {qvMediaLoading && (
                    <div className="w-11 h-11 rounded-lg shrink-0 bg-black/10 animate-pulse" />
                  )}
                </div>

              {/* Main display - a video if one's selected, otherwise the
                  photo (color-aware default, or a specific uploaded photo
                  once one's been picked from the rail). Zoom-on-hover only
                  makes sense for photos, so it's disabled while a video is
                  showing. object-contain (not object-cover) so the whole
                  product is always visible here, never cropped - the rail
                  thumbnails stay cropped-to-square since they're just
                  small previews. */}
              <div
                className={`flex-1 min-w-0 h-full ${qvSelectedMediaIndex !== null && qvMediaList[qvSelectedMediaIndex]?.type === 'video' ? 'bg-black' : darkMode ? 'bg-white/5' : 'bg-zinc-100'} relative overflow-hidden`}
                onMouseMove={(e) => {
                  if (qvSelectedMediaIndex !== null && qvMediaList[qvSelectedMediaIndex]?.type === 'video') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setZoomOrigin({ x, y });
                  setZoomActive(true);
                }}
                onMouseLeave={() => setZoomActive(false)}
                onTouchStart={(e) => {
                  if (qvSelectedMediaIndex !== null && qvMediaList[qvSelectedMediaIndex]?.type === 'video') return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touch = e.touches[0];
                  const x = ((touch.clientX - rect.left) / rect.width) * 100;
                  const y = ((touch.clientY - rect.top) / rect.height) * 100;
                  setZoomOrigin({ x, y });
                  setZoomActive(true);
                }}
                onTouchMove={(e) => {
                  if (qvSelectedMediaIndex !== null && qvMediaList[qvSelectedMediaIndex]?.type === 'video') return;
                  e.preventDefault();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const touch = e.touches[0];
                  const x = ((touch.clientX - rect.left) / rect.width) * 100;
                  const y = ((touch.clientY - rect.top) / rect.height) * 100;
                  setZoomOrigin({ x, y });
                }}
                onTouchEnd={() => setZoomActive(false)}
              >
                {qvSelectedMediaIndex !== null && qvMediaList[qvSelectedMediaIndex]?.type === 'video' ? (
                  <div
                    className="w-full h-full relative"
                    onClick={(e) => {
                      // Custom play/pause instead of relying on the browser's
                      // built-in video controls - native controls only
                      // toggle play when you click the exact visible video
                      // frame, not the black letterbox padding around it.
                      // Making our own full-box tap target (matching how
                      // AliExpress's player behaves) means it can't conflict
                      // with a second, separate native click-handler.
                      e.stopPropagation();
                      const v = qvVideoRef.current;
                      if (!v) return;
                      if (v.paused) v.play(); else v.pause();
                    }}
                  >
                    <video
                      ref={qvVideoRef}
                      src={qvMediaList[qvSelectedMediaIndex].url}
                      className="w-full h-full object-contain"
                      autoPlay
                      muted={qvVideoMuted}
                      playsInline
                      loop
                      onPlay={() => setQvVideoPlaying(true)}
                      onPause={() => setQvVideoPlaying(false)}
                    />
                    {!qvVideoPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center text-white text-2xl">▶</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setQvVideoMuted((m) => !m); }}
                      aria-label={qvVideoMuted ? 'Unmute' : 'Mute'}
                      className="absolute bottom-3 left-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm"
                    >
                      {qvVideoMuted ? '🔇' : '🔊'}
                    </button>
                  </div>
                ) : (
                  <img
                    src={qvSelectedMediaIndex !== null ? qvMediaList[qvSelectedMediaIndex].url : getQvDisplayImage()}
                    alt={quickViewListing.name}
                    className={`w-full h-full object-contain ${zoomActive ? 'scale-[2.4]' : 'scale-100'} transition-transform duration-100 ease-out cursor-zoom-in`}
                    style={{ transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` }}
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }}
                  />
                )}
                {(qvMediaList.length > 0) && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); qvGalleryStep(-1); }}
                      aria-label="Previous photo"
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70"
                    >‹</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); qvGalleryStep(1); }}
                      aria-label="Next photo"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm hover:bg-black/70"
                    >›</button>
                  </>
                )}
                <button onClick={() => setQuickViewId(null)} className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-sm">✕</button>
                {!isOwnQuickViewListing && (
                  <button
                    disabled={!canAddQuickViewToCart}
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart(quickViewListing, quickViewListing.hasVariants ? pickedColor : '', quickViewListing.hasVariants ? pickedSize : '');
                      setQuickViewId(null);
                    }}
                    aria-label="Add to cart"
                    className="absolute bottom-3 right-3 w-14 h-14 rounded-full bg-gradient-to-br from-lime-400 to-sky-400 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-transform disabled:opacity-40"
                  >
                    <TrolleyIcon className="w-7 h-7" />
                  </button>
                )}
              </div>
            </div>

            {/* ---------- MIDDLE: scrollable info ---------- */}
            <div className="w-full md:flex-1 min-w-0 md:min-h-0 md:h-full md:overflow-y-auto p-6 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_rgba(163,230,53,0.8)]" />
                  <span className="text-[11px] uppercase tracking-wider text-lime-600 font-semibold">Verified on-chain</span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-lime-400/10 text-lime-600 border border-lime-400/30">🔒 Escrow Protected</span>
                {verifiedSellers.has(quickViewListing.seller.toLowerCase()) && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold bg-sky-400/10 text-sky-600 border border-sky-400/30">✓ Verified Seller</span>
                )}
              </div>
              {(() => {
                const summary = getSellerRatingSummary(quickViewListing.seller);
                // "Sold" count is just the number of non-cancelled orders
                // this listing has - already sitting in data we read for
                // every other order-related feature, so no new storage
                // needed to show it here.
                const soldCount = allOrders.filter((o) => o.listingId === quickViewListing.id && !o.cancelled).length;
                if (!summary && soldCount === 0) return null;
                return (
                  <p className={`text-xs ${subtleText} mb-2 flex items-center gap-1 flex-wrap`}>
                    {summary && (
                      <>
                        <span className="text-amber-400">{'★'.repeat(Math.round(summary.average))}{'☆'.repeat(5 - Math.round(summary.average))}</span>
                        {summary.average.toFixed(1)} ({summary.count} review{summary.count === 1 ? '' : 's'})
                      </>
                    )}
                    {soldCount > 0 && (<span>{summary ? ' · ' : ''}{soldCount} sold</span>)}
                  </p>
                );
              })()}
              <h3 className="font-semibold text-xl mb-2">{quickViewListing.name}</h3>
              <span className="text-2xl font-mono block mb-4 bg-gradient-to-r from-lime-500 to-sky-500 bg-clip-text text-transparent">
                {(Number(quickViewListing.price) / 1e18).toString()} {currencySymbol(quickViewListing.paymentToken)}
              </span>

              {quickViewListing.hasVariants ? (
                <>
                  {qvHasColors && (
                    <div className="mb-4">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${subtleText} mb-2`}>Color</p>
                      <div className="flex flex-wrap gap-2">
                        {quickViewListing.colors.map((c) => {
                          const anySizeAvailable = quickViewListing.sizes.some((s) => getQvStock(c, s) > 0);
                          const swatchImg = getQvColorSwatchImage(c);
                          return (
                            <button
                              key={c}
                              disabled={!anySizeAvailable}
                              onClick={() => { setPickedColor(c); setPickedSize(''); setQvSelectedMediaIndex(null); }}
                              className={`flex flex-col items-center gap-1 ${!anySizeAvailable ? 'opacity-30 cursor-not-allowed' : ''}`}
                            >
                              <span className={`w-12 h-12 rounded-lg overflow-hidden border-2 ${pickedColor === c ? 'border-lime-400' : cardBorder}`}>
                                {swatchImg ? (
                                  <img src={swatchImg} alt={c} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                                ) : (
                                  <span className={`w-full h-full flex items-center justify-center text-[9px] ${subtleText} ${darkMode ? 'bg-white/5' : 'bg-zinc-100'}`}>{c.slice(0, 3)}</span>
                                )}
                              </span>
                              <span className={`text-[10px] font-medium ${pickedColor === c ? 'text-lime-500' : subtleText}`}>{c}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {qvHasSizes && (
                    <div className="mb-5">
                      <p className={`text-xs font-semibold uppercase tracking-wide ${subtleText} mb-2`}>Size</p>
                      <div className="flex flex-wrap gap-2">
                        {quickViewListing.sizes.map((s) => {
                          const available = (!qvHasColors || pickedColor) ? getQvStock(qvHasColors ? pickedColor : NO_VARIANT, s) > 0 : false;
                          return (
                            <button
                              key={s}
                              disabled={(qvHasColors && !pickedColor) || !available}
                              onClick={() => setPickedSize(s)}
                              className={`px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors ${(qvHasColors && !pickedColor) || !available ? 'opacity-30 cursor-not-allowed' : pickedSize === s ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 border-transparent' : `${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                      {qvColorReady && qvSizeReady && (
                        <p className={`text-xs ${subtleText} mt-2`}>{getQvStock(qvHasColors ? pickedColor : NO_VARIANT, qvHasSizes ? pickedSize : NO_VARIANT)} left in stock</p>
                      )}
                    </div>
                  )}
                  {!qvHasSizes && qvColorReady && (
                    <p className={`text-xs ${subtleText} mb-5`}>{getQvStock(qvHasColors ? pickedColor : NO_VARIANT, NO_VARIANT)} left in stock</p>
                  )}
                </>
              ) : (
                <p className={`text-xs ${subtleText} mb-5`}>{quickViewListing.simpleStock.toString()} in stock</p>
              )}

              {quickViewListing.hasVariants && !(qvColorReady && qvSizeReady) && (
                <p className={`text-xs ${subtleText}`}>{!qvColorReady ? 'Select a color above, then tap the cart icon on the photo to add it.' : 'Select a size above, then tap the cart icon on the photo to add it.'}</p>
              )}

              {qvSpecs.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-sm mb-2">Specifications</h4>
                  <div className={`rounded-xl border ${cardBorder} divide-y ${darkMode ? 'divide-white/10' : 'divide-zinc-100'} overflow-hidden`}>
                    {qvSpecs.map((spec, i) => (
                      <div key={i} className="flex text-xs">
                        <span className={`w-1/3 shrink-0 px-3 py-2 font-medium ${darkMode ? 'bg-white/5' : 'bg-zinc-50'}`}>{spec.label}</span>
                        <span className="flex-1 px-3 py-2">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {qvDescription.trim() && (
                <div className="mt-6">
                  <h4 className="font-semibold text-sm mb-2">Description</h4>
                  <p className={`text-sm ${subtleText} whitespace-pre-wrap`}>{qvDescription}</p>
                </div>
              )}

              {(() => {
                // Reviews are now filtered down to just THIS item, using
                // the listing_id already stored on each review row (the
                // backend already had this data, it just wasn't being
                // used on the display side until now - no Edge Function
                // or database change was needed for this).
                const allReviews = (sellerReviewsMap[quickViewListing.seller.toLowerCase()] || []).filter((r) => r.listingId === quickViewListing.id);
                if (allReviews.length === 0) return null;
                const counts = [5, 4, 3, 2, 1].map((star) => ({
                  star, count: allReviews.filter((r) => r.rating === star).length,
                }));
                const total = allReviews.length;
                const average = allReviews.reduce((sum, r) => sum + r.rating, 0) / total;
                const filtered = qvReviewFilter === 'all' ? allReviews : allReviews.filter((r) => r.rating === qvReviewFilter);
                return (
                  <div className="mt-6">
                    <h4 className="font-semibold text-sm mb-3">Customer Reviews ({total})</h4>
                    <div className="flex items-start gap-6 mb-4 flex-wrap">
                      <div className="shrink-0">
                        <p className="text-3xl font-bold">{average.toFixed(1)}</p>
                        <p className="text-amber-400 text-sm">{'★'.repeat(Math.round(average))}{'☆'.repeat(5 - Math.round(average))}</p>
                      </div>
                      <div className="flex-1 min-w-[140px] space-y-1">
                        {counts.map(({ star, count }) => (
                          <div key={star} className="flex items-center gap-2 text-[11px]">
                            <span className={`w-5 text-right ${subtleText}`}>{star}★</span>
                            <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-white/10' : 'bg-zinc-100'}`}>
                              <div className="h-full bg-amber-400" style={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }} />
                            </div>
                            <span className={`w-6 ${subtleText}`}>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
                      <button onClick={() => setQvReviewFilter('all')} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${qvReviewFilter === 'all' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 border-transparent' : `${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>All ({total})</button>
                      {counts.filter((c) => c.count > 0).map(({ star, count }) => (
                        <button key={star} onClick={() => setQvReviewFilter(star as 1 | 2 | 3 | 4 | 5)} className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${qvReviewFilter === star ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 border-transparent' : `${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}>{star}★ ({count})</button>
                      ))}
                    </div>

                    <div className="space-y-4">
                      {filtered.map((r) => {
                        const order = allOrders.find((o) => o.id === r.orderId);
                        return (
                          <div key={r.orderId} className={`pb-4 border-b ${cardBorder} last:border-b-0 last:pb-0`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-amber-400 text-xs">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                              <span className={`text-[10px] ${subtleText}`}>{new Date(r.createdAt).toLocaleDateString()}</span>
                            </div>
                            {order && (order.color || order.size) && (
                              <p className={`text-[10px] ${subtleText} mb-1`}>
                                {order.color && `Color: ${order.color}`}{order.color && order.size ? ' · ' : ''}{order.size && `Size: ${order.size}`}
                              </p>
                            )}
                            {r.ratingItem !== null && r.ratingCommunication !== null && r.ratingShipping !== null && (
                              <div className={`flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] ${subtleText} mb-1.5`}>
                                <span>Item: <span className="text-amber-400">{'★'.repeat(r.ratingItem)}{'☆'.repeat(5 - r.ratingItem)}</span></span>
                                <span>Comm: <span className="text-amber-400">{'★'.repeat(r.ratingCommunication)}{'☆'.repeat(5 - r.ratingCommunication)}</span></span>
                                <span>Shipping: <span className="text-amber-400">{'★'.repeat(r.ratingShipping)}{'☆'.repeat(5 - r.ratingShipping)}</span></span>
                              </div>
                            )}
                            {r.reviewText && <p className="text-sm">{r.reviewText}</p>}
                            <div className="flex items-center justify-between mt-1">
                              <p className={`text-[10px] ${subtleText} font-mono`}>{r.buyerAddress.slice(0, 6)}...{r.buyerAddress.slice(-4)}</p>
                              <button
                                onClick={() => toggleHelpful(r.orderId, quickViewListing.seller)}
                                className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg border ${helpfulVotedIds.has(r.orderId) ? 'bg-lime-400/10 border-lime-400/40 text-lime-600' : `${cardBorder} ${subtleText} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}`}
                              >
                                👍 Helpful{r.helpfulCount > 0 ? ` (${r.helpfulCount})` : ''}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ---------- RIGHT: seller + actions sidebar ---------- */}
            <div className={`w-full md:w-[280px] md:shrink-0 md:min-h-0 md:h-full md:overflow-y-auto border-t md:border-t-0 md:border-l ${cardBorder} p-6 [&::-webkit-scrollbar]:hidden`} style={{ scrollbarWidth: 'none' }}>
              <div className="relative mb-4">
                <div className="flex items-center gap-2">
                  <Link href={`/seller/${quickViewListing.seller}`} target="_blank" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarGradient(quickViewListing.seller)} flex items-center justify-center text-[10px] font-bold text-white shrink-0`}>{quickViewListing.seller.slice(2, 4).toUpperCase()}</div>
                    {quickViewSellerName ? (
                      <div className="min-w-0">
                        <p className="text-sm font-semibold underline leading-tight truncate">{quickViewSellerName}</p>
                        <p className={`text-[10px] ${subtleText} font-mono leading-tight`}>{quickViewListing.seller.slice(0, 6)}...{quickViewListing.seller.slice(-4)}</p>
                      </div>
                    ) : (
                      <p className={`text-xs ${subtleText} font-mono underline`}>{quickViewListing.seller.slice(0, 6)}...{quickViewListing.seller.slice(-4)}</p>
                    )}
                  </Link>
                  <button
                    onClick={() => setSellerCardOpen((v) => !v)}
                    aria-label="Store details"
                    className={`shrink-0 w-5 h-5 rounded-full border ${cardBorder} ${subtleText} text-[10px] flex items-center justify-center ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'}`}
                  >
                    ⓘ
                  </button>
                </div>

                {sellerCardOpen && (() => {
                  const reviews = sellerReviewsMap[quickViewListing.seller.toLowerCase()] || [];
                  const withBreakdown = reviews.filter((r) => r.ratingItem !== null && r.ratingCommunication !== null && r.ratingShipping !== null);
                  const avg = (key: 'ratingItem' | 'ratingCommunication' | 'ratingShipping') =>
                    withBreakdown.length > 0 ? withBreakdown.reduce((sum, r) => sum + (r[key] || 0), 0) / withBreakdown.length : 0;
                  const categories = [
                    { label: 'Item as Described', value: avg('ratingItem') },
                    { label: 'Communication', value: avg('ratingCommunication') },
                    { label: 'Shipping Speed', value: avg('ratingShipping') },
                  ];
                  return (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setSellerCardOpen(false)} />
                      <div className={`absolute left-0 top-full mt-2 w-72 ${cardBg} border ${cardBorder} rounded-2xl shadow-lg z-50 p-4`}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient(quickViewListing.seller)} flex items-center justify-center text-[11px] font-bold text-white shrink-0`}>{quickViewListing.seller.slice(2, 4).toUpperCase()}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{quickViewSellerName || 'This seller'}</p>
                            <p className={`text-[10px] ${subtleText} font-mono`}>{quickViewListing.seller.slice(0, 6)}...{quickViewListing.seller.slice(-4)}</p>
                          </div>
                        </div>
                        <p className={`text-[11px] ${subtleText} mb-3`}>
                          {quickViewSellerJoined ? `Member since ${new Date(quickViewSellerJoined).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}` : 'Member since unknown'}
                        </p>
                        <div className={`border-t ${cardBorder} pt-3`}>
                          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2">Detailed Seller Ratings</p>
                          {withBreakdown.length === 0 ? (
                            <p className={`text-xs ${subtleText}`}>No detailed ratings yet.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {categories.map((c) => (
                                <div key={c.label} className="flex items-center justify-between text-xs">
                                  <span className={subtleText}>{c.label}</span>
                                  <span className="font-medium">{c.value.toFixed(1)} <span className="text-amber-400">★</span></span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {isOwnQuickViewListing && (
                <div>
                  <p className={`text-xs ${subtleText} text-center mb-3`}>This is your own listing.</p>
                  <button
                    onClick={() => { setQuickViewId(null); setActiveTab('sell'); setSellSubTab('list'); openEditListing(quickViewListing); }}
                    className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all"
                  >
                    Edit This Listing
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[65] p-4" onClick={() => setCartOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-lg">Your Cart</h3><button onClick={() => setCartOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button></div>
            {cart.length === 0 ? (
              <p className={`${subtleText} text-sm py-8 text-center`}>Your cart is empty. Tap any item to add it.</p>
            ) : (
              <>
                <div className="space-y-3 mb-5">
                  {cart.map((line, index) => {
                    const listing = getListingById(line.listingId);
                    if (!listing) return null;
                    const displayImage = listing.imageUrl && listing.imageUrl.trim() !== '' ? listing.imageUrl : FALLBACK_IMAGE;
                    return (
                      <div key={index} className={`flex items-center gap-3 p-2 rounded-xl border ${cardBorder}`}>
                        <img src={displayImage} alt={listing.name} className="w-14 h-14 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMAGE; }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{listing.name}</p>
                          {(line.color || line.size) && (<p className={`text-xs ${subtleText}`}>{line.color}{line.color && line.size ? ' · ' : ''}{line.size}</p>)}
                          <p className="text-sm font-mono text-lime-500">{(Number(listing.price) / 1e18).toString()} {currencySymbol(listing.paymentToken)}</p>
                        </div>
                        <button onClick={() => removeFromCart(index)} className="text-red-500 text-xs font-medium shrink-0 px-2">Remove</button>
                      </div>
                    );
                  })}
                </div>
                {checkoutSummary && (
                  <div className={`mb-5 p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} space-y-1.5`}>
                    <div className="flex justify-between text-sm"><span className={subtleText}>Subtotal</span><span className="font-mono">{(Number(checkoutSummary.subtotal) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                    <div className="flex justify-between text-sm"><span className={subtleText}>Buyer fee ({buyerFeePct}%)</span><span className="font-mono">{(Number(checkoutSummary.fee) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                    <div className={`flex justify-between text-sm font-semibold pt-1.5 border-t ${cardBorder}`}><span>Total</span><span className="font-mono text-lime-500">{(Number(checkoutSummary.total) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                  </div>
                )}
                <div className="space-y-2">
                  {!isConnected ? (
                    <button onClick={() => { setCartOpen(false); openWalletChoice(); }} className={`w-full py-3 ${darkMode ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-900 text-white hover:bg-zinc-800'} rounded-2xl font-medium transition-colors`}>Connect to Checkout</button>
                  ) : (
                    <button onClick={() => { setCartOpen(false); setShippingForm(emptyShipping); setShippingDialCode('+1'); setShippingPhoneLocal(''); setShippingModal(true); }} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">Checkout</button>
                  )}
                  <button onClick={() => { setCart([]); setCartCurrency(null); }} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Clear Cart</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {shippingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[90vh] overflow-y-auto`}>
            <h3 className="font-semibold text-lg mb-1">Shipping Details</h3>
            <p className={`text-xs ${subtleText} mb-4`}>Saved securely so your seller can view it to ship your order.</p>
            <div className="space-y-3 mb-5">
              <input type="text" placeholder="Full Name" value={shippingForm.fullName} onChange={(e) => setShippingForm({ ...shippingForm, fullName: e.target.value })} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              <input type="text" placeholder="Street Address" value={shippingForm.address} onChange={(e) => setShippingForm({ ...shippingForm, address: e.target.value })} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="City" value={shippingForm.city} onChange={(e) => setShippingForm({ ...shippingForm, city: e.target.value })} className={`${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
                <input type="text" placeholder="State / Province" value={shippingForm.state} onChange={(e) => setShippingForm({ ...shippingForm, state: e.target.value })} className={`${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} />
              </div>
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Country</label>
                <select
                  value={shippingForm.country}
                  onChange={(e) => {
                    const chosenCountry = e.target.value;
                    const match = COUNTRIES.find((c) => c.name === chosenCountry);
                    // Picking a country updates the phone dial code to match it
                    // automatically - the buyer almost always ships to their
                    // own country's number format anyway.
                    if (match) setShippingDialCode(match.dial);
                    const newDial = match ? match.dial : shippingDialCode;
                    setShippingForm({ ...shippingForm, country: chosenCountry, phone: shippingPhoneLocal ? `${newDial} ${shippingPhoneLocal}` : '' });
                  }}
                  className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}
                >
                  <option value="" style={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', color: darkMode ? '#ffffff' : '#18181b' }}>Select a country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name} style={{ backgroundColor: darkMode ? '#18181b' : '#ffffff', color: darkMode ? '#ffffff' : '#18181b' }}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`text-xs ${subtleText} block mb-1`}>Phone (optional)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    list="dial-code-options"
                    placeholder="+1"
                    value={shippingDialCode}
                    onChange={(e) => { setShippingDialCode(e.target.value); setShippingForm({ ...shippingForm, phone: shippingPhoneLocal ? `${e.target.value} ${shippingPhoneLocal}` : '' }); }}
                    className={`w-24 shrink-0 ${inputBg} border ${cardBorder} rounded-xl px-3 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm`}
                  />
                  <datalist id="dial-code-options">
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.dial}>{c.name}</option>
                    ))}
                  </datalist>
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={shippingPhoneLocal}
                    onChange={(e) => { setShippingPhoneLocal(e.target.value); setShippingForm({ ...shippingForm, phone: e.target.value ? `${shippingDialCode} ${e.target.value}` : '' }); }}
                    className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`}
                  />
                </div>
                <p className={`text-[11px] ${subtleText} mt-1`}>Type to search (e.g. "+234" or "Nigeria"), or it fills in automatically from the country above.</p>
              </div>
            </div>
            {checkoutSummary && (
              <div className={`mb-5 p-4 rounded-2xl ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder} space-y-1.5`}>
                <div className="flex justify-between text-sm"><span className={subtleText}>Subtotal</span><span className="font-mono">{(Number(checkoutSummary.subtotal) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                <div className="flex justify-between text-sm"><span className={subtleText}>Buyer fee ({buyerFeePct}%)</span><span className="font-mono">{(Number(checkoutSummary.fee) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
                <div className={`flex justify-between text-sm font-semibold pt-1.5 border-t ${cardBorder}`}><span>Total</span><span className="font-mono text-lime-500">{(Number(checkoutSummary.total) / 1e18).toFixed(4)} {checkoutSummary.symbol}</span></div>
              </div>
            )}
            <div className="space-y-2">
              <button onClick={confirmShippingAndBuy} disabled={isPending} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">{isPending ? 'Confirm in wallet...' : 'Buy / Pay'}</button>
              <button onClick={() => setShippingModal(false)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {chatModalOrderId !== null && (() => {
        const order = allOrders.find((o) => o.id === chatModalOrderId);
        const listing = order ? getListingById(order.listingId) : null;
        if (!order || !listing) return null;
        const isBuyerHere = address?.toLowerCase() === order.buyer.toLowerCase();
        const otherParty = isBuyerHere ? listing.seller : order.buyer;
        const messages = chatMessagesMap[chatModalOrderId] || [];
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4" onClick={() => setChatModalOrderId(null)}>
            <div className={`${cardBg} rounded-3xl w-full max-w-md border ${cardBorder} max-h-[85vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
              <div className={`px-6 py-4 border-b ${cardBorder} flex items-center justify-between`}>
                <div>
                  <h3 className="font-semibold text-lg">{listing.name}</h3>
                  <p className={`text-xs ${subtleText} font-mono`}>{isBuyerHere ? 'Seller' : 'Buyer'}: {otherParty.slice(0, 6)}...{otherParty.slice(-4)}</p>
                </div>
                <button onClick={() => setChatModalOrderId(null)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center shrink-0`}>✕</button>
              </div>
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {chatLoading ? (
                  <p className={`text-sm ${subtleText} text-center py-8`}>Decrypting messages...</p>
                ) : messages.length === 0 ? (
                  <p className={`text-sm ${subtleText} text-center py-8`}>No messages yet. Say hello 👋</p>
                ) : (
                  messages.map((m) => {
                    const mine = m.fromAddress.toLowerCase() === address?.toLowerCase();
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${mine ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : `${darkMode ? 'bg-white/10' : 'bg-zinc-100'}`}`}>
                          {m.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {chatUnavailable === chatModalOrderId && (
                <div className="px-6 pb-2">
                  <p className={`text-xs ${subtleText} p-3 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} border ${cardBorder}`}>
                    {isBuyerHere ? 'This seller' : 'This buyer'} hasn't opened their orders yet, so chat isn't ready on their end. Your message will be ready to send as soon as they check their orders - try again in a bit.
                  </p>
                </div>
              )}
              <div className={`px-6 py-4 border-t ${cardBorder} flex gap-2`}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !chatSending) sendChatMessage(chatModalOrderId, otherParty); }}
                  placeholder="Type a message..."
                  className={`flex-1 min-w-0 ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm`}
                />
                <button onClick={() => sendChatMessage(chatModalOrderId, otherParty)} disabled={chatSending || !chatInput.trim()} className="px-4 py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl font-semibold text-sm disabled:opacity-50 shrink-0">
                  {chatSending ? '...' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {reviewModalOrderId !== null && (() => {
        const order = allOrders.find((o) => o.id === reviewModalOrderId);
        const listing = order ? getListingById(order.listingId) : null;
        if (!order || !listing) return null;
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4" onClick={() => setReviewModalOrderId(null)}>
            <div className={`${cardBg} rounded-3xl w-full max-w-sm border ${cardBorder} p-6`} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-lg">Leave a Review</h3>
                <button onClick={() => setReviewModalOrderId(null)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center shrink-0`}>✕</button>
              </div>
              <p className={`text-xs ${subtleText} mb-4`}>{listing.name}</p>
              <div className="space-y-4 mb-4">
                {[
                  { label: 'Item as Described', value: reviewRatingItem, setValue: setReviewRatingItem },
                  { label: 'Communication', value: reviewRatingCommunication, setValue: setReviewRatingCommunication },
                  { label: 'Shipping Speed', value: reviewRatingShipping, setValue: setReviewRatingShipping },
                ].map(({ label, value, setValue }) => (
                  <div key={label}>
                    <p className={`text-xs font-medium ${subtleText} mb-1`}>{label}</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setValue(star)} className="text-2xl leading-none transition-transform hover:scale-110">
                          {star <= value ? <span className="text-amber-400">★</span> : <span className={subtleText}>☆</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="How was your experience with this seller? (optional)"
                rows={3}
                className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm resize-none mb-4`}
              />
              <button onClick={() => submitReview(order.id, listing.id, listing.seller)} disabled={reviewSubmitting || reviewRatingItem < 1 || reviewRatingCommunication < 1 || reviewRatingShipping < 1} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">
                {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        );
      })()}

      {evidenceModalOrderId !== null && (() => {
        const order = allOrders.find((o) => o.id === evidenceModalOrderId);
        const listing = order ? getListingById(order.listingId) : null;
        if (!order || !listing) return null;
        const items = evidenceMap[evidenceModalOrderId] || [];
        const status = caseStatusMap[evidenceModalOrderId];
        const isResolved = order.released;
        const outcome = getDisputeOutcome(evidenceModalOrderId);
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4" onClick={() => setEvidenceModalOrderId(null)}>
            <div className={`${cardBg} rounded-3xl w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Dispute Evidence</h3>
                  <p className={`text-xs ${subtleText}`}>{listing.name} — visible to both parties and support staff reviewing this case.</p>
                </div>
                <button onClick={() => setEvidenceModalOrderId(null)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center shrink-0`}>✕</button>
              </div>

              {isResolved && (
                <div className="px-6 mb-3">
                  <div className={`p-3 rounded-xl border border-lime-400/40 bg-lime-400/10`}>
                    <p className="text-xs font-semibold text-lime-600 mb-1">
                      {outcome?.recorded
                        ? `✓ Resolved — ${outcome.paidToSeller ? 'seller was paid' : 'buyer was refunded'}`
                        : '✓ This dispute has been resolved'}
                    </p>
                    {!outcome?.recorded && (
                      <p className={`text-[11px] ${subtleText} mb-1`}>This was resolved before outcome tracking was added, so the exact result isn't on record here.</p>
                    )}
                    {status?.note?.trim() ? (
                      <p className="text-sm">{status.note}</p>
                    ) : (
                      <p className={`text-xs ${subtleText}`}>No note was left explaining the decision.</p>
                    )}
                  </div>
                </div>
              )}

              <div className="px-6 space-y-3 mb-4">
                {items.length === 0 ? (
                  <p className={`text-sm ${subtleText} py-2`}>No evidence submitted yet.</p>
                ) : (
                  items.map((item) => (
                    <div key={item.id} className={`p-3 rounded-xl border ${cardBorder} ${darkMode ? 'bg-white/5' : 'bg-zinc-50'}`}>
                      <p className={`text-[10px] ${subtleText} font-mono mb-2`}>{item.submittedBy.slice(0, 6)}...{item.submittedBy.slice(-4)}</p>
                      {item.imageUrl && <img src={item.imageUrl} alt="Evidence" className="w-full rounded-lg mb-2 max-h-64 object-cover" />}
                      {item.note && <p className="text-sm">{item.note}</p>}
                    </div>
                  ))
                )}
              </div>
              <div className={`px-6 pb-6 pt-2 border-t ${cardBorder} space-y-2`}>
                <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${cardBorder} text-xs font-medium cursor-pointer ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'}`}>
                  {evidenceUploading ? 'Uploading...' : '📷 Upload Photo'}
                  <input type="file" accept="image/*" className="hidden" disabled={evidenceUploading} onChange={handleEvidenceImageUpload} />
                </label>
                {evidenceImageUrl && (<img src={evidenceImageUrl} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-zinc-300/30" />)}
                <textarea
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  placeholder="Add a note explaining what happened (optional if you're attaching a photo)"
                  rows={3}
                  className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm resize-none`}
                />
                <button onClick={() => submitEvidence(evidenceModalOrderId)} disabled={evidenceSubmitting} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl font-semibold text-sm disabled:opacity-50">
                  {evidenceSubmitting ? 'Confirm in wallet...' : 'Submit Evidence'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {disputeCenterOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder}`}>
            <h3 className="font-semibold text-lg mb-1">Open a Dispute</h3>
            <p className={`text-xs ${subtleText} mb-4`}>Select the trade you have an issue with.</p>
            <div className="space-y-2 mb-4 max-h-80 overflow-y-auto">
              {disputeEligible.map((order) => {
                const listing = getListingById(order.listingId);
                const role = address?.toLowerCase() === order.buyer.toLowerCase() ? 'Buyer' : 'Seller';
                return (
                  <div key={order.id} className={`flex items-center justify-between p-3 rounded-xl border ${cardBorder}`}>
                    <div><p className="font-medium text-sm">{listing?.name || `Order #${order.id}`}</p><p className={`text-xs ${subtleText}`}>You are the {role}</p></div>
                    <button
                      onClick={() => {
                        const otherParty = role === 'Buyer' ? listing?.seller : order.buyer;
                        if (otherParty) {
                          setPendingActionNotify({
                            toAddress: otherParty,
                            title: '⚠️ Dispute raised',
                            body: `A dispute was opened on "${listing?.name || `Order #${order.id}`}". Check the Dispute Queue for details.`,
                            orderId: order.id,
                          });
                        }
                        call('raiseDispute', [BigInt(order.id)]);
                        setDisputeCenterOpen(false);
                      }}
                      disabled={isPending}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                    >
                      Raise Dispute
                    </button>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setDisputeCenterOpen(false)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Close</button>
          </div>
        </div>
      )}

      {resolveCenterOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-lg border ${cardBorder} max-h-[85vh] overflow-y-auto`}>
            <h3 className="font-semibold text-lg mb-1">Dispute Queue</h3>
            <p className={`text-xs ${subtleText} mb-4`}>
              {disputeQueueTab === 'open'
                ? `${disputedOrders.length} case${disputedOrders.length === 1 ? '' : 's'} awaiting a decision.`
                : `${resolvedDisputedOrders.length} past case${resolvedDisputedOrders.length === 1 ? '' : 's'} - evidence and notes stay visible for reference.`}
            </p>

            <div className={`flex rounded-xl border ${cardBorder} p-1 mb-4`}>
              <button onClick={() => setDisputeQueueTab('open')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${disputeQueueTab === 'open' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>Open ({disputedOrders.length})</button>
              <button onClick={() => setDisputeQueueTab('resolved')} className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${disputeQueueTab === 'resolved' ? 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900' : subtleText}`}>Resolved ({resolvedDisputedOrders.length})</button>
            </div>

            <div className="space-y-4 mb-4">
              {(disputeQueueTab === 'open' ? disputedOrders : resolvedDisputedOrders).length === 0 ? (
                <p className={`text-sm ${subtleText} py-4 text-center`}>
                  {disputeQueueTab === 'open' ? 'No open disputes right now.' : 'No resolved disputes yet.'}
                </p>
              ) : (
                (disputeQueueTab === 'open' ? disputedOrders : resolvedDisputedOrders).map((order) => {
                  const listing = getListingById(order.listingId);
                  const items = evidenceMap[order.id] || [];
                  const status = caseStatusMap[order.id];
                  const claimedByMe = status?.claimedBy?.toLowerCase() === address?.toLowerCase();
                  const claimedBySomeoneElse = status?.claimedBy && !claimedByMe;
                  const isResolved = disputeQueueTab === 'resolved';
                  const outcome = isResolved ? getDisputeOutcome(order.id) : null;
                  return (
                    <div key={order.id} className={`p-4 rounded-2xl border ${cardBorder} ${darkMode ? 'bg-white/5' : 'bg-zinc-50'} ${isResolved ? 'opacity-90' : ''}`}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{listing?.name || `Order #${order.id}`} — {listing ? (Number(listing.price) / 1e18).toString() : ''} {listing ? currencySymbol(listing.paymentToken) : ''}</p>
                        {isResolved ? (
                          <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap ${darkMode ? 'bg-white/10' : 'bg-zinc-200'} ${subtleText}`}>
                            {outcome?.recorded ? `✓ ${outcome.paidToSeller ? 'Paid seller' : 'Refunded buyer'}` : '✓ Resolved'}
                          </span>
                        ) : (
                          <button
                            onClick={() => toggleClaimCase(order.id)}
                            disabled={!!claimedBySomeoneElse}
                            className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap ${claimedByMe ? 'bg-lime-400/20 text-lime-600 border border-lime-400/40' : claimedBySomeoneElse ? `${subtleText} border ${cardBorder} cursor-not-allowed` : `border ${cardBorder} ${darkMode ? 'hover:bg-white/10' : 'hover:bg-white'}`}`}
                          >
                            {claimedByMe ? '✓ Claimed by you' : claimedBySomeoneElse ? `Claimed: ${status!.claimedBy!.slice(0, 6)}...${status!.claimedBy!.slice(-4)}` : 'Claim this case'}
                          </button>
                        )}
                      </div>
                      <p className={`text-[11px] ${subtleText} font-mono mb-3`}>Buyer: {order.buyer.slice(0, 6)}...{order.buyer.slice(-4)} {listing && `· Seller: ${listing.seller.slice(0, 6)}...${listing.seller.slice(-4)}`}</p>

                      <div className="mb-3">
                        <p className={`text-[10px] uppercase tracking-wide font-semibold ${subtleText} mb-2`}>Evidence submitted</p>
                        {items.length === 0 ? (
                          <p className={`text-xs ${subtleText}`}>Nothing was submitted by either party.</p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((item) => (
                              <div key={item.id} className={`p-2 rounded-xl border ${cardBorder} ${cardBg}`}>
                                <p className={`text-[10px] ${subtleText} font-mono mb-1`}>{item.submittedBy.slice(0, 6)}...{item.submittedBy.slice(-4)}</p>
                                {item.imageUrl && <img src={item.imageUrl} alt="Evidence" className="w-full rounded-lg mb-1 max-h-48 object-cover" />}
                                {item.note && <p className="text-xs">{item.note}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={isResolved ? '' : 'mb-3'}>
                        <p className={`text-[10px] uppercase tracking-wide font-semibold ${subtleText} mb-2`}>Moderator notes</p>
                        {isResolved ? (
                          <p className={`text-xs p-2 rounded-lg border ${cardBorder} ${cardBg}`}>{status?.note?.trim() ? status.note : <span className={subtleText}>No notes were left on this case.</span>}</p>
                        ) : (
                          <textarea
                            value={noteDrafts[order.id] ?? status?.note ?? ''}
                            onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                            onBlur={() => saveNote(order.id)}
                            placeholder="Add a recommendation or note for the admin/other moderators..."
                            rows={2}
                            className={`w-full ${cardBg} border ${cardBorder} rounded-lg px-3 py-2 text-xs outline-none focus:border-lime-400 transition-colors resize-none`}
                          />
                        )}
                      </div>

                      {!isResolved && (
                        isAdmin ? (
                          <div className="flex gap-2">
                            <button onClick={() => { setResolvingDispute(true); call('resolveDispute', [BigInt(order.id), true]); }} disabled={isPending} className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">Pay Seller</button>
                            <button onClick={() => { setResolvingDispute(true); call('resolveDispute', [BigInt(order.id), false]); }} disabled={isPending} className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">Refund Buyer</button>
                          </div>
                        ) : (
                          <p className={`text-[11px] ${subtleText} italic`}>You can review this case, but only the admin wallet can finalize a decision.</p>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <button onClick={() => setResolveCenterOpen(false)} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Close</button>
          </div>
        </div>
      )}

      {adminSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setAdminSettingsOpen(false)}>
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-md border ${cardBorder} max-h-[85vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Admin Settings</h3>
              <button onClick={() => setAdminSettingsOpen(false)} className={`w-8 h-8 rounded-full ${darkMode ? 'hover:bg-white/10' : 'hover:bg-zinc-100'} flex items-center justify-center`}>✕</button>
            </div>

            <div className="space-y-3 mb-4">
              <div><label className={`text-xs ${subtleText} block mb-1`}>Listing Fee (tBNB)</label><input type="number" step="0.0001" min="0" value={newListingFee} onChange={(e) => setNewListingFee(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Ad Subscription Fee (tBNB)</label><input type="number" step="0.0001" min="0" value={newAdFee} onChange={(e) => setNewAdFee(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Ad Subscription Duration (days)</label><input type="number" step="1" min="1" value={newAdDurationDays} onChange={(e) => setNewAdDurationDays(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Points per Listing</label><input type="number" step="1" min="0" value={newPointsPerListing} onChange={(e) => setNewPointsPerListing(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Points per Purchase</label><input type="number" step="1" min="0" value={newPointsPerPurchase} onChange={(e) => setNewPointsPerPurchase(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Points per Sale</label><input type="number" step="1" min="0" value={newPointsPerSale} onChange={(e) => setNewPointsPerSale(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Welcome Bonus Points</label><input type="number" step="1" min="0" value={newWelcomeBonus} onChange={(e) => setNewWelcomeBonus(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Referral Points (to referrer)</label><input type="number" step="1" min="0" value={newReferralPoints} onChange={(e) => setNewReferralPoints(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <div><label className={`text-xs ${subtleText} block mb-1`}>Referee Bonus Points (to friend)</label><input type="number" step="1" min="0" value={newRefereeBonusPoints} onChange={(e) => setNewRefereeBonusPoints(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors`} /></div>
              <button onClick={saveAdminSettings} disabled={isPending} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all disabled:opacity-50">{isPending ? 'Confirm in wallet...' : 'Save Fee & Points Settings'}</button>
            </div>

            <div className={`border-t ${cardBorder} pt-4 mb-4`}>
              <h4 className="font-semibold text-sm mb-1">Points System</h4>
              <p className={`text-xs ${subtleText} mb-3`}>{pointsSystemActiveNow ? 'Currently active - new points are being awarded.' : 'Currently OFF - no new points are being awarded. Everyone\'s existing points are unaffected.'}</p>
              <button onClick={togglePointsSystem} disabled={isPending} className={`w-full py-2 text-sm font-medium rounded-xl disabled:opacity-50 ${pointsSystemActiveNow ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900'}`}>
                {isPending ? 'Confirm in wallet...' : pointsSystemActiveNow ? 'Turn Off Points System' : 'Turn On Points System'}
              </button>
            </div>

            <div className={`border-t ${cardBorder} pt-4 mb-4`}>
              <h4 className="font-semibold text-sm mb-1">Force-Remove a Listing</h4>
              <p className={`text-xs ${subtleText} mb-3`}>For prohibited or non-compliant items. Overrides the seller — cannot be undone.</p>
              <div className="space-y-2">
                <input type="number" placeholder="Listing ID" value={modListingId} onChange={(e) => setModListingId(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm`} />
                <input type="text" placeholder="Reason (recorded on-chain)" value={modReason} onChange={(e) => setModReason(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm`} />
                <button onClick={handleAdminDelist} disabled={isPending} className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{isPending ? 'Confirm in wallet...' : 'Force Delist'}</button>
              </div>
            </div>

            <div className={`border-t ${cardBorder} pt-4`}>
              <h4 className="font-semibold text-sm mb-1">Remove From Sponsored Strip</h4>
              <p className={`text-xs ${subtleText} mb-3`}>Pulls one item out of ads without cancelling the seller's whole subscription.</p>
              <div className="space-y-2">
                <input type="number" placeholder="Listing ID" value={modFeaturedListingId} onChange={(e) => setModFeaturedListingId(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm`} />
                <button onClick={handleAdminRemoveFeatured} disabled={isPending} className={`w-full py-2 text-sm font-medium border ${cardBorder} rounded-xl ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} disabled:opacity-50`}>{isPending ? 'Confirm in wallet...' : 'Remove From Ads'}</button>
              </div>
            </div>

            <div className={`border-t ${cardBorder} pt-4 mt-4`}>
              <h4 className="font-semibold text-sm mb-1">Fund a Tester (Send Test BNB)</h4>
              <p className={`text-xs ${subtleText} mb-3`}>Sends tBNB directly from your own wallet to a tester's address, using this site's reliable gas settings - no faucet, no MetaMask guessing.</p>
              <div className="space-y-2">
                <input type="text" placeholder="Tester wallet address (0x...)" value={faucetToAddress} onChange={(e) => setFaucetToAddress(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm font-mono`} />
                <input type="number" step="0.01" min="0" placeholder="Amount in tBNB" value={faucetAmount} onChange={(e) => setFaucetAmount(e.target.value)} className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-4 py-2.5 outline-none focus:border-lime-400 transition-colors text-sm`} />
                <button onClick={handleSendTestBnb} disabled={isFaucetPending} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50">{isFaucetPending ? 'Confirm in wallet...' : 'Send Test BNB'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {walletChoiceOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-sm border ${cardBorder} max-h-[90vh] overflow-y-auto`}>
            <h3 className="font-semibold text-lg mb-1">Connect Your Wallet</h3>
            <p className={`text-xs ${subtleText} mb-4`}>New here? Pick any option below — a wallet is created for you automatically.</p>
            {oauthErr && (<div className="mb-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30"><p className="text-xs text-red-500 font-medium">{oauthErr}</p></div>)}
            {privyAuthenticated && !isConnected && (<div className="mb-3 p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center gap-2"><div className="w-4 h-4 border-2 border-sky-500 border-t-transparent rounded-full animate-spin shrink-0" /><p className="text-xs text-sky-600 font-medium">Setting up your wallet, one moment...</p></div>)}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={handleGoogleLogin} disabled={!privyReady} className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} font-medium text-sm disabled:opacity-50`}><span className="w-5 h-5 rounded-full bg-white border border-zinc-300 flex items-center justify-center text-[11px] font-bold text-blue-500">G</span>Google</button>
              <button onClick={handleTwitterLogin} disabled={!privyReady} className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} font-medium text-sm disabled:opacity-50`}><span className="w-5 h-5 rounded-full bg-black flex items-center justify-center text-[11px] font-bold text-white">𝕏</span>X</button>
            </div>
            <button onClick={handlePasskeyLogin} disabled={!privyReady} className={`w-full flex items-center justify-center gap-2 py-3 px-3 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} font-medium text-sm disabled:opacity-50 mb-3`}>🔑 Continue with Passkey</button>
            <div className={`p-3 rounded-2xl border ${cardBorder} mb-3`}>
              {emailStep === 'input' ? (
                <div className="space-y-2">
                  <label className={`text-xs ${subtleText} block`}>Or continue with email</label>
                  <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="you@example.com" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-3 py-2 outline-none focus:border-lime-400 text-sm`} />
                  <button onClick={handleSendCode} disabled={emailBusy || !emailInput.trim()} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50">{emailBusy ? 'Sending...' : 'Send Code'}</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className={`text-xs ${subtleText} block`}>Enter the code sent to {emailInput}</label>
                  <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="123456" className={`w-full ${inputBg} border ${cardBorder} rounded-xl px-3 py-2 outline-none focus:border-lime-400 text-sm tracking-widest`} />
                  <button onClick={handleVerifyCode} disabled={emailBusy || !codeInput.trim()} className="w-full py-2.5 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-xl text-sm font-semibold disabled:opacity-50">{emailBusy ? 'Verifying...' : 'Verify & Continue'}</button>
                  <button onClick={resetEmailFlow} className={`w-full text-xs ${subtleText} py-1`}>Use a different email</button>
                </div>
              )}
              {emailErr && <p className="text-xs text-red-500 mt-2">{emailErr}</p>}
            </div>
            <div className={`flex items-center gap-3 mb-3`}><div className={`flex-1 h-px ${darkMode ? 'bg-white/10' : 'bg-zinc-200'}`} /><span className={`text-xs ${subtleText}`}>or use your own wallet</span><div className={`flex-1 h-px ${darkMode ? 'bg-white/10' : 'bg-zinc-200'}`} /></div>
            <div className="space-y-2 mb-4">
              <button onClick={() => { connectWallet(); setWalletChoiceOpen(false); }} className={`w-full py-3 px-4 rounded-2xl border ${cardBorder} ${darkMode ? 'hover:bg-white/5' : 'hover:bg-zinc-50'} text-left font-medium transition-colors`}>
                Connect Existing Wallet
                <span className={`block text-xs font-normal mt-0.5 ${subtleText}`}>MetaMask, WalletConnect, Coinbase Wallet, and more</span>
              </button>
            </div>
            <button onClick={() => { setWalletChoiceOpen(false); resetEmailFlow(); setOauthErr(''); }} className={`w-full py-2.5 ${darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-zinc-100 hover:bg-zinc-200'} rounded-xl text-sm font-medium transition-colors`}>Cancel</button>
          </div>
        </div>
      )}

      {helpModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[75] p-4">
          <div className={`${cardBg} rounded-3xl p-6 w-full max-w-lg border ${cardBorder} max-h-[85vh] overflow-y-auto`}>
            <h3 className="font-semibold text-xl mb-1">Welcome to {BRAND_NAME} 👋</h3>
            <p className={`text-sm ${subtleText} mb-5`}>This is a testnet — everything here uses fake, free test money. Nothing costs real funds. Here's how to get started:</p>
            <div className="space-y-4 mb-6">
              <div><p className="font-semibold text-sm mb-1">1. Connect</p><p className={`text-sm ${subtleText} mb-2`}>Tap the ☰ menu, then <strong>Login</strong>. The easiest way in is <strong>Google, X, Passkey, or email</strong> — no wallet app needed, we create one for you automatically.</p></div>
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
                <p className={`text-sm ${subtleText}`}>You'll be shown 12 words called a <strong>Secret Recovery Phrase</strong>. Write it down on paper and keep it somewhere safe. <strong>Never</strong> type it into any website, never share it with anyone (including us), and never take a screenshot of it.</p>
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
              <div><p className="font-semibold text-sm mb-1">3. Get free test BNB</p><p className={`text-sm ${subtleText}`}>Visit <span className="text-sky-500">testnet.bnbchain.org/faucet-smart</span>, paste your wallet address, and claim free tBNB (and optionally test USDC/USDT).</p></div>
              <div><p className="font-semibold text-sm mb-1">4. Try it out</p><p className={`text-sm ${subtleText}`}>Tap any item, choose a color/size if it has options, and add it to your cart, then tap the cart icon at the top to checkout. Funds are held safely in escrow until you confirm receipt — try releasing funds, cancelling, or raising a dispute to see the full flow.</p></div>
            </div>
            <button onClick={() => setHelpModalOpen(false)} className="w-full py-3 bg-gradient-to-r from-lime-400 to-sky-400 text-zinc-900 rounded-2xl font-semibold hover:opacity-90 transition-all">Got it, let's go</button>
          </div>
        </div>
      )}
    </div>
  );
}
