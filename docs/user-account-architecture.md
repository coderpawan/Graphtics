# User Profile & Account Management System

## Overview
This module upgrades the Graphtics e-commerce application with a scalable account management system built for production-readiness.
It combines a modern dashboard UI with a clean architecture for user profile state, Firestore persistence, and reusable account components.

## Frontend Architecture

### Folder structure
- `src/pages/AccountPage.tsx` — main profile dashboard and management UX
- `src/pages/OrdersPage.tsx` — order history, status filters, invoice actions
- `src/pages/WishlistPage.tsx` — saved items list with move-to-cart support
- `src/context/AuthContext.tsx` — enriched auth context for profile operations
- `src/firebase/firestore.ts` — Firestore persistence helpers for profile, addresses, preferences, notifications
- `src/firebase/auth.ts` — Firebase auth helpers including secure password changes
- `src/firebase/storage.ts` — profile image upload helper
- `src/types/index.ts` — shared types for `UserProfile`, `Address`, `UserPreferences`, and account models
- `src/components/ui/*` — reusable UI primitives: `Card`, `Button`, `Input`, `Badge`, `LoadingScreen`

### Reusable Components
- `Button`, `Card`, `Input`, `Badge` are reused across the account dashboard
- The account dashboard is split into logical sections (overview, profile, addresses, preferences, security) inside `AccountPage.tsx`
- Order and wishlist pages use shared data hooks and Firebase queries for dynamic content

### State management
- `AuthContext` is the single source of truth for authenticated user data
- Profile updates are applied both locally in React state and persisted to Firestore
- Cart operations still use the existing `cartStore.ts` with `useCartStore`
- React Query is used for data fetching of user orders and recently viewed products

## Database Schema / Firestore Models

### users collection
Each user document is stored under `users/{uid}` and includes:
- `name`, `email`, `phone`, `avatarUrl`
- `gender`, `dob`, `createdAt`, `membershipStatus`
- `role`, `wishlist`, `recentlyViewed`
- `savedAddresses: Address[]`
- `preferences: { savedSizes, preferredFit, preferredBrands, preferredColors, preferredStyles, favouriteCategories }`
- `notifications: { pushNotifications, orderAlerts, marketing }`
- `communicationPreferences: { emailUpdates, smsUpdates, offers, restockAlerts }`
- `loginHistory: LoginSession[]`

### orders collection
Order documents contain:
- `userId`, item list, pricing totals, shipping address
- `status`, `placedAt`, `estimatedDelivery`
- `subtotal`, `shipping`, `tax`, `discount`, `total`

### products collection
Products remain in the existing `products` collection.
Wishlist and recently viewed data store IDs in the user profile, with products fetched on demand.

## API / Service Layer

### Firestore helper functions
- `getUserProfile(uid)`
- `syncUserProfile(profile)`
- `updateUserAddresses(uid, addresses)`
- `updateUserPreferences(uid, preferences)`
- `updateUserNotifications(uid, notifications)`
- `updateUserCommunicationPreferences(uid, communicationPreferences)`
- `updateUserWishlist(uid, productId, add)`
- `getOrdersByUser(uid)`
- `getProductsByIds(ids)`

### Auth helper functions
- `loginWithEmail(email, password)`
- `registerWithEmail(email, password)`
- `loginWithGoogle()`
- `sendResetLink(email)`
- `changePassword(currentPassword, newPassword)`
- `logout()`

### Storage helper functions
- `uploadProfileImage(uid, file)`

## UI Flow

### Profile Dashboard
- After login, the `/account` page displays a dashboard with:
  - profile avatar and loyalty status
  - core profile info (name, email, phone, gender, dob)
  - saved addresses and default shipping/billing controls
  - recently viewed products and wishlist count
  - membership overview and order stats
- Users can switch tabs to manage personal info, addresses, preferences, and security settings.

### Profile Management
- Personal profile form supports editing name, phone, gender, DOB, and uploading a profile photo
- Notification and communication preferences can be toggled in the security/settings section
- Password changes use secure Firebase reauthentication

### Address Management
- Users can add/edit/delete addresses
- Each address includes full name, phone, pincode, state, city, landmark, line 1, line 2
- Users can set default shipping and billing addresses

### Order Management
- The orders page provides:
  - filtered order history by `all`, `delivered`, `cancelled`, `processing`, `returned`
  - order metadata and shipment summary
  - invoice/download and return/track actions

### Wishlist
- Wishlist items are displayed as product cards
- Users can move wishlist items into cart directly
- Cards show image, size, color, price, and discount

## Security Implementation Strategy

### Identity & session security
- Firebase handles authentication sessions and token expiry
- Protected routes are enforced with `ProtectedRoute` around `/account`, `/orders`, `/wishlist`, and `/checkout`
- Password updates require Firebase reauthentication via `EmailAuthProvider` and `updatePassword`

### Data validation and error handling
- Form values are validated in the UI before submission
- Toast notifications provide success/error feedback
- Firestore update helpers are isolated in `src/firebase/firestore.ts`
- Auth errors are surfaced cleanly from `AuthContext`

### Scalability considerations
- Profile data is normalized for fast reads: order history lives in `orders`, while profile preferences and wishlist stay with `users`
- `getProductsByIds` fetches only needed product docs for wishlist/recent views
- React Query caches order and product data

## Next improvements

For a fully enterprise-grade system, the next steps are:
- Add pagination to orders and wishlist queries
- Record login activity and device sessions in Firestore
- Add audit logging and role-based access controls for admin users
- Separate larger account components into dedicated reusable files under `src/components/account/`
- Add a dedicated profile edit modal with validation and autosave feedback
