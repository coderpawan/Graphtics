export type ProductVariant = {
  id: string;
  color: string;
  image: string;
  stock: number;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  date: string;
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
  variants: ProductVariant[];
  sizes: string[];
  colors: string[];
  stock: number;
  sku: string;
  isTrending: boolean;
  isNew: boolean;
  isLimited: boolean;
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

export type Order = {
  id: string;
  userId: string;
  items: Array<{ productId: string; quantity: number; size: string; color: string; price: number }>;
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  status: OrderStatus;
  placedAt: string;
  estimatedDelivery: string;
  shippingAddress: string;
};
