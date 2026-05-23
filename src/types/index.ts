/** Optional third-party storefront URLs (set in admin). */
export type MarketplaceLinks = {
  amazon?: string;
  flipkart?: string;
  meesho?: string;
  myntra?: string;
};

export type ProductVariant = {
  id: string;
  color: string;
  image: string;
  stock: number;
  /** Present for admin variant matrix rows */
  size?: string;
  sku?: string;
};

export type ReviewSource = 'customer' | 'admin';

export type Review = {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  date: string;
  /** Populated for Firestore-backed reviews. */
  source?: ReviewSource;
  /** Admin-curated review photos (storefront customers cannot attach images). */
  images?: string[];
  productId?: string;
  userId?: string;
  orderFirestoreId?: string;
};

/** Customer complaint / suggestion tied to a single order (redressal in admin). */
export type OrderComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type OrderComplaintMessageAuthor = 'customer' | 'admin';

export type OrderComplaintMessage = {
  id: string;
  author: OrderComplaintMessageAuthor;
  body: string;
  createdAt: string;
};

export type OrderComplaint = {
  id: string;
  orderFirestoreId: string;
  orderHumanId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  /** Primary contact — required. */
  phone: string;
  /** Optional alternate number. */
  phoneAlt?: string;
  /** Opening message (kept for rules / legacy); full history is in `thread`. */
  message: string;
  status: OrderComplaintStatus;
  /** Latest admin reply text (legacy + search); thread holds full conversation. */
  adminResponse?: string;
  thread?: OrderComplaintMessage[];
  createdAt?: string;
  updatedAt?: string;
  resolvedAt?: string;
};

export type Coupon = {
  id: string;
  code: string;
  discount: number;
  active: boolean;
  expiresAt?: string;
  createdAt?: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  compareAtPrice?: number;
  rating: number;
  reviews: Review[];
  images: string[];
  /** Resolved from admin `imagesByColor` — image URLs per color (carousel on PDP). */
  colorImages?: Record<string, string[]>;
  /** Which color is featured in listings and selected first on PDP. */
  defaultDisplayColor?: string;
  variants: ProductVariant[];
  sizes: string[];
  colors: string[];
  stock: number;
  sku: string;
  isTrending: boolean;
  isNew: boolean;
  isLimited: boolean;
  marketplaceLinks?: MarketplaceLinks;
  /** Short bullet lines under the description (admin). */
  highlights?: string[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
  };
};

export type CartItem = {
  productId: string;
  variantId: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
  name: string;
  image: string;
  /** Optional storefront / catalog SKU for fulfillment & returns. */
  lineSku?: string;
};

export type UserRole = 'customer' | 'super-admin' | 'staff' | 'designer' | 'inventory-manager' | 'manager';

export type Address = {
  id: string;
  fullName: string;
  phone: string;
  pincode: string;
  state: string;
  city: string;
  landmark?: string;
  addressLine1: string;
  addressLine2?: string;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
};

export type CommunicationPreferences = {
  emailUpdates: boolean;
  smsUpdates: boolean;
  offers: boolean;
  restockAlerts: boolean;
};

export type NotificationSettings = {
  pushNotifications: boolean;
  orderAlerts: boolean;
  marketing: boolean;
};

export type UserPreferences = {
  savedSizes: string[];
  preferredFit: string;
  preferredBrands: string[];
  preferredColors: string[];
  preferredStyles: string[];
  favouriteCategories: string[];
};

export type LoginSession = {
  id: string;
  device: string;
  location?: string;
  createdAt: string;
  expiresAt?: string;
  lastActiveAt?: string;
};

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  /** Alternate phone for delivery / support. */
  phoneAlt?: string;
  avatarUrl?: string;
  gender?: 'male' | 'female' | 'non-binary' | 'other';
  dob?: string;
  createdAt?: string;
  membershipStatus?: 'bronze' | 'silver' | 'gold' | 'platinum';
  role: UserRole;
  wishlist: string[];
  recentlyViewed: string[];
  savedAddresses: Address[];
  preferences: UserPreferences;
  notifications: NotificationSettings;
  communicationPreferences: CommunicationPreferences;
  loginHistory: LoginSession[];
  isOffline?: boolean;
};

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'printed'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type OrderLineItem = {
  productId: string;
  quantity: number;
  size: string;
  color: string;
  price: number;
  /** Product title at checkout (for invoices & admin). */
  name?: string;
  /** Variant SKU when known (improves returns / restock). */
  sku?: string;
};

export type OrderFulfillmentEvent = {
  at: string;
  status: OrderStatus;
  note?: string;
  actor?: 'customer' | 'admin' | 'system';
};

export type OrderReturnRequest = {
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  reason: string;
  requestedAt: string;
  resolvedAt?: string;
  adminNote?: string;
};

export type OrderAdminNote = {
  id: string;
  at: string;
  text: string;
};

/** Proof photos for dispatch / label / handover — admin-only; stored on the order document. */
export type OrderPackageTrackingPhoto = {
  id: string;
  url: string;
  caption?: string;
  uploadedAt: string;
};

export type Order = {
  id: string;
  /** Firebase Auth uid — same as `customerId` in admin views. */
  userId: string;
  /** Human-readable reference (e.g. GRP-XXXX); stored as `orderId` in Firestore. */
  orderId?: string;
  /** Denormalized for admin / exports (checkout). */
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerPhoneAlt?: string;
  /** Payment lifecycle; new checkout orders use `pending` until a gateway or admin sets `paid`. */
  paymentStatus?: 'pending' | 'paid' | 'failed';
  items: OrderLineItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  placedAt: string;
  estimatedDelivery: string;
  shippingAddress: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  /** Optional explicit URL; otherwise derived in UI from carrier + tracking number. */
  trackingUrl?: string;
  /** Label scans, packed parcel photos, POD screenshots — for internal tracking. */
  packageTrackingPhotos?: OrderPackageTrackingPhoto[];
  fulfillmentEvents?: OrderFulfillmentEvent[];
  returnRequest?: OrderReturnRequest | null;
  cancelledAt?: string;
  cancelReason?: string;
  adminNotes?: OrderAdminNote[];
};
