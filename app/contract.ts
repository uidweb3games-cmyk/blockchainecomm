export const MARKETPLACE_ADDRESS = "0xe252b78bb00fd576Ad01f8B352629dA557F1B775" as const;

export const USDC_ADDRESS = "0x64544969ed7EBf5f083679233325356EbE738930" as const;
export const USDT_ADDRESS = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as const;

export const ERC20_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "spender", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "owner", "type": "address" },
      { "internalType": "address", "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "account", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const MARKETPLACE_ABI = [
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "autoRelease", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "string", "name": "_color", "type": "string" }, { "internalType": "string", "name": "_size", "type": "string" }], "name": "buyItem", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256[]", "name": "_listingIds", "type": "uint256[]" }, { "internalType": "string[]", "name": "_colors", "type": "string[]" }, { "internalType": "string[]", "name": "_sizes", "type": "string[]" }, { "internalType": "address", "name": "_token", "type": "address" }], "name": "buyMultiple", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "cancelAndRefund", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }], "name": "delistItem", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }], "name": "DisputeRaised", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }, { "indexed": false, "internalType": "bool", "name": "paidToSeller", "type": "bool" }], "name": "DisputeResolved", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }], "name": "FundsAutoReleased", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }, { "indexed": false, "internalType": "uint256", "name": "listingId", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "buyer", "type": "address" }, { "indexed": false, "internalType": "string", "name": "color", "type": "string" }, { "indexed": false, "internalType": "string", "name": "size", "type": "string" }], "name": "ItemBought", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }], "name": "ItemCancelled", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "listingId", "type": "uint256" }], "name": "ItemDelisted", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "id", "type": "uint256" }, { "indexed": false, "internalType": "string", "name": "name", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "price", "type": "uint256" }, { "indexed": false, "internalType": "address", "name": "seller", "type": "address" }], "name": "ItemListed", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "listingId", "type": "uint256" }], "name": "ListingUpdated", "type": "event" },
  { "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }, { "internalType": "string", "name": "_imageUrl", "type": "string" }, { "internalType": "string", "name": "_category", "type": "string" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }, { "internalType": "address", "name": "_paymentToken", "type": "address" }, { "internalType": "uint256", "name": "_stock", "type": "uint256" }], "name": "listItem", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "string", "name": "_name", "type": "string" }, { "internalType": "string", "name": "_imageUrl", "type": "string" }, { "internalType": "string", "name": "_category", "type": "string" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }, { "internalType": "address", "name": "_paymentToken", "type": "address" }, { "internalType": "string[]", "name": "_colors", "type": "string[]" }, { "internalType": "string[]", "name": "_sizes", "type": "string[]" }, { "internalType": "uint256[]", "name": "_stockMatrix", "type": "uint256[]" }, { "internalType": "string[]", "name": "_colorImages", "type": "string[]" }], "name": "listItemWithVariants", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "raiseDispute", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }], "name": "releaseFunds", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }, { "internalType": "bool", "name": "payToSeller", "type": "bool" }], "name": "resolveDispute", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_fee", "type": "uint256" }], "name": "setListingFee", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "anonymous": false, "inputs": [{ "indexed": false, "internalType": "uint256", "name": "orderId", "type": "uint256" }, { "indexed": false, "internalType": "uint8", "name": "status", "type": "uint8" }], "name": "ShippingUpdated", "type": "event" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "string", "name": "_color", "type": "string" }, { "internalType": "string", "name": "_newImageUrl", "type": "string" }], "name": "updateColorImage", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "string", "name": "_name", "type": "string" }, { "internalType": "string", "name": "_imageUrl", "type": "string" }, { "internalType": "string", "name": "_category", "type": "string" }, { "internalType": "uint256", "name": "_price", "type": "uint256" }], "name": "updateListing", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_orderId", "type": "uint256" }, { "internalType": "uint8", "name": "_status", "type": "uint8" }], "name": "updateShippingStatus", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "uint256", "name": "_newStock", "type": "uint256" }], "name": "updateSimpleStock", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "string", "name": "_color", "type": "string" }, { "internalType": "string", "name": "_size", "type": "string" }, { "internalType": "uint256", "name": "_newStock", "type": "uint256" }], "name": "updateVariantStock", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [], "name": "admin", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "buyerFeePercent", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "feeWallet", "outputs": [{ "internalType": "address payable", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "string", "name": "_color", "type": "string" }, { "internalType": "string", "name": "_size", "type": "string" }], "name": "getAvailableStock", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }, { "internalType": "string", "name": "_color", "type": "string" }], "name": "getColorImage", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }], "name": "getListing", "outputs": [{ "internalType": "string", "name": "", "type": "string" }, { "internalType": "string", "name": "", "type": "string" }, { "internalType": "string", "name": "", "type": "string" }, { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }, { "internalType": "address", "name": "", "type": "address" }, { "internalType": "bool", "name": "", "type": "bool" }, { "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }], "name": "getListingVariants", "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }, { "internalType": "string[]", "name": "", "type": "string[]" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_id", "type": "uint256" }], "name": "getOrder", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "address", "name": "", "type": "address" }, { "internalType": "string", "name": "", "type": "string" }, { "internalType": "string", "name": "", "type": "string" }, { "internalType": "bool", "name": "", "type": "bool" }, { "internalType": "bool", "name": "", "type": "bool" }, { "internalType": "bool", "name": "", "type": "bool" }, { "internalType": "uint256", "name": "", "type": "uint256" }, { "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "uint256", "name": "_listingId", "type": "uint256" }], "name": "getTotalPrice", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "listingCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "listingFee", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "orderCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "releaseWindow", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "sellerFeePercent", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
] as const;
