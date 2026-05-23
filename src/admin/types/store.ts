/**
 * Firestore shapes for the clothing storefront admin (authoritative for services & pages).
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  MarketplaceLinks,
  OrderAdminNote,
  OrderFulfillmentEvent,
  OrderPackageTrackingPhoto,
  OrderReturnRequest,
  OrderStatus,
  Review,
} from '../../types';

export type StoreProductStatus = 'active' | 'draft';

export interface StoreProductVariant {
  size: string;
  color: string;
  sku: string;
  stock: number;
  /** Firestore `products/{id}/skus/{skuId}` — set by SKU sync. */
  skuId?: string;
  barcode?: string;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  salePrice: number;
  categories: string[];
  images: string[];
  /**
   * Storefront photos per color (e.g. black tee vs white tee). Multiple URLs per color = carousel on PDP.
   * Keys must match variant `color` labels exactly. Legacy docs may store a single string per key.
   */
  imagesByColor?: Record<string, string[]>;
  /** Featured color for product cards, home, and default selection on PDP. */
  defaultDisplayColor?: string;
  status: StoreProductStatus;
  variants: StoreProductVariant[];
  /** Optional catalog-wide default for new SKU rows; falls back to a derived value when omitted. */
  safetyStockDefault?: number;
  /** Third-party listing URLs — buttons on the product page only when set. */
  marketplaceLinks?: MarketplaceLinks;
  /** Short bullet lines under the description on the storefront. */
  highlights?: string[];
  isTrending?: boolean;
  isNew?: boolean;
  isLimited?: boolean;
  /** Admin-authored storefront reviews (may include images). Merged into PDP reviews. */
  curatedReviews?: Review[];
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export type StorePaymentStatus = 'pending' | 'paid' | 'failed';

/** Re-export for admin order UIs — same values as storefront `Order.status`. */
export type StoreOrderStatus = OrderStatus;

export interface StoreOrderItem {
  productId: string;
  sku: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  /** Denormalized product title when present on the order document. */
  name?: string;
  /** Optional denormalized category labels for analytics */
  categories?: string[];
}

export interface StoreOrder {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerPhoneAlt?: string;
  shippingAddress: string;
  items: StoreOrderItem[];
  totalAmount: number;
  paymentStatus: StorePaymentStatus;
  /** Fulfillment lifecycle — persisted as Firestore `status` (not `shippingStatus`). */
  status: StoreOrderStatus;
  /** Set when an admin cancels from the dashboard — used to remove cancellation and restore `status`. */
  statusBeforeAdminCancel?: StoreOrderStatus;
  cancelledAt?: string;
  /** Customer or admin cancellation note (Firestore `cancelReason`). */
  cancelReason?: string;
  trackingNumber: string;
  trackingCarrier: string;
  trackingUrl: string;
  /** Dispatch / label / parcel photos for internal tracking (URLs in Firebase Storage or external). */
  packageTrackingPhotos: OrderPackageTrackingPhoto[];
  returnRequest: OrderReturnRequest | null;
  fulfillmentEvents: OrderFulfillmentEvent[];
  adminNotes: OrderAdminNote[];
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface VariantInventoryRow {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  stock: number;
}

/** Authoritative SKU row (`products/{productId}/skus/{skuId}`). */
export interface ProductSkuDoc {
  id: string;
  productId: string;
  productName: string;
  categories: string[];
  skuCode: string;
  barcode: string;
  variantKey: string;
  /** e.g. { size: 'M', color: 'Black' } */
  attributes: Record<string, string>;
  onHand: number;
  reserved: number;
  available: number;
  safetyStock: number;
  stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock';
  isLowStock: boolean;
  version: number;
  status: 'active' | 'discontinued';
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

export interface StockLedgerEntry {
  id: string;
  timestamp?: Timestamp | Date;
  userId: string;
  productId: string;
  skuId: string;
  skuCode: string;
  reasonCode: string;
  deltaOnHand: number;
  balanceOnHandAfter: number;
  balanceAvailableAfter: number;
  versionAfter: number;
  notes: string;
  source: 'admin_ui' | 'checkout' | 'import' | 'system';
  bulkJobId?: string;
}

/** One product block for the inventory matrix UI. */
export interface InventoryMatrixProduct {
  productId: string;
  productName: string;
  categories: string[];
  sizes: string[];
  colors: string[];
  /** color -> size -> sku row */
  cells: Record<string, Record<string, ProductSkuDoc | null>>;
}

export interface StoreCategoryMetadata {
  mainCategories: string[];
  /** Map of main category name -> subcategory labels */
  subcategories: Record<string, string[]>;
}
