# Firestore Collections Schema

This document outlines the Firestore database schema for the Admin Panel.

## Collections

### 1. admins
User collection for admin staff

```
admins/
  ├── {adminId}
      ├── id: string (document ID)
      ├── email: string
      ├── name: string
      ├── avatar: string (optional)
      ├── role: 'super-admin' | 'product-manager' | 'inventory-manager' | 'finance-manager' | 'customer-support'
      ├── permissions: Permission[]
      │   ├── id: string
      │   ├── name: string
      │   ├── resource: string
      │   └── action: 'create' | 'read' | 'update' | 'delete' | 'export'
      ├── isActive: boolean
      ├── lastLogin: timestamp
      ├── createdAt: timestamp
      └── updatedAt: timestamp
```

### 2. products
Product catalog collection

```
products/
  ├── {productId}
      ├── id: string (document ID)
      ├── sku: string (unique)
      ├── barcode: string (optional)
      ├── name: string
      ├── description: string
      ├── slug: string
      ├── category: string
      ├── subcategory: string
      ├── collection: string (optional)
      ├── gender: 'male' | 'female' | 'unisex' (optional)
      ├── material: string (optional)
      ├── fabricType: string (optional)
      ├── fitType: 'slim' | 'regular' | 'oversized' | 'skinny' (optional)
      ├── price: {
      │   ├── cost: number
      │   ├── retail: number
      │   └── wholesale: number (optional)
      │ }
      ├── discount: {
      │   ├── type: 'percentage' | 'fixed'
      │   ├── value: number
      │   ├── validFrom: timestamp
      │   └── validUntil: timestamp
      │ } (optional)
      ├── images: {
      │   ├── id: string
      │   ├── url: string
      │   ├── alt: string
      │   ├── isPrimary: boolean
      │   └── order: number
      │ }[]
      ├── variants: {
      │   ├── id: string
      │   ├── sku: string
      │   ├── size: string (optional)
      │   ├── color: string (optional)
      │   ├── price: number (optional)
      │   ├── stock: number
      │   └── images: { ... }[] (optional)
      │ }[]
      ├── tags: string[]
      ├── seoMetadata: {
      │   ├── metaTitle: string
      │   ├── metaDescription: string
      │   └── keywords: string[]
      │ }
      ├── status: 'draft' | 'published' | 'archived'
      ├── inventory: {
      │   ├── totalStock: number
      │   ├── reservedStock: number
      │   └── availableStock: number
      │ }
      ├── views: number (optional)
      ├── unitsSold: number (optional)
      ├── rating: number (optional)
      ├── createdAt: timestamp
      ├── updatedAt: timestamp
      └── createdBy: string
```

### 3. orders
Orders collection

```
orders/
  ├── {orderId}
      ├── id: string (document ID)
      ├── orderNumber: string (unique)
      ├── customerId: string
      ├── customerEmail: string
      ├── customerPhone: string
      ├── status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned'
      ├── items: {
      │   ├── productId: string
      │   ├── productName: string
      │   ├── variantId: string (optional)
      │   ├── quantity: number
      │   ├── unitPrice: number
      │   ├── discount: number (optional)
      │   └── subtotal: number
      │ }[]
      ├── subtotal: number
      ├── tax: number
      ├── shipping: number
      ├── total: number
      ├── paymentMethod: 'credit-card' | 'debit-card' | 'paypal' | 'stripe' | 'bank-transfer'
      ├── paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
      ├── shippingAddress: {
      │   ├── fullName: string
      │   ├── street: string
      │   ├── city: string
      │   ├── state: string
      │   ├── zipCode: string
      │   ├── country: string
      │   └── phone: string
      │ }
      ├── billingAddress: { ... }
      ├── notes: string (optional)
      ├── trackingNumber: string (optional)
      ├── carrier: string (optional)
      ├── returnRequests: {
      │   ├── id: string
      │   ├── reason: string
      │   ├── status: 'pending' | 'approved' | 'rejected' | 'completed'
      │   ├── refundAmount: number
      │   ├── requestedAt: timestamp
      │   └── resolvedAt: timestamp (optional)
      │ }[]
      ├── createdAt: timestamp
      └── updatedAt: timestamp
```

> **Storefront / admin (`orders` in this repo)** also uses: `orderId`, `customerId` / `userId`, line items with `sku`, `size`, `color`, `totalAmount` or `total`, `paymentStatus`: `'pending' | 'paid' | 'failed'`, fulfillment `status` (`pending` → `confirmed` → `printed` → `packed` → `shipped` → `delivered`), `trackingCarrier`, `trackingUrl`, `fulfillmentEvents`, `adminNotes`, `returnRequest`, **`cancelledAt`**, **`cancelReason`** (customer or admin), **`statusBeforeAdminCancel`** (set only on admin dashboard cancel — enables “remove cancellation”), and **`packageTrackingPhotos`**: `{ id, url, caption?, uploadedAt }[]` (label / parcel images; files in Storage under `orders/{id}/package-tracking/`).

### 4. customers
Customer profiles collection

```
customers/
  ├── {customerId}
      ├── id: string (document ID)
      ├── email: string (unique)
      ├── firstName: string
      ├── lastName: string
      ├── phone: string (optional)
      ├── avatar: string (optional)
      ├── status: 'active' | 'inactive' | 'suspended' | 'blocked'
      ├── totalOrders: number
      ├── totalSpent: number
      ├── lastOrderDate: timestamp (optional)
      ├── addresses: {
      │   ├── fullName: string
      │   ├── street: string
      │   ├── city: string
      │   ├── state: string
      │   ├── zipCode: string
      │   ├── country: string
      │   └── phone: string
      │ }[]
      ├── wishlistCount: number
      ├── registeredAt: timestamp
      ├── notes: string (optional)
      ├── suspensionReason: string (optional)
      ├── blockReason: string (optional)
      └── blockedAt: timestamp (optional)
```

### 5. inventory
Stock management collection

```
inventory/
  ├── {itemId}
      ├── id: string (document ID)
      ├── productId: string
      ├── productName: string
      ├── sku: string
      ├── variantId: string (optional)
      ├── quantity: number
      ├── reservedQuantity: number
      ├── availableQuantity: number
      ├── reorderLevel: number
      ├── reorderQuantity: number
      ├── lastRestocked: timestamp (optional)
      ├── warehouse: string (optional)
      ├── status: 'in-stock' | 'low-stock' | 'out-of-stock'
      └── location: string (optional)
```

### 6. inventoryAuditLogs
Audit log for inventory changes

```
inventoryAuditLogs/
  ├── {logId}
      ├── id: string (document ID)
      ├── itemId: string
      ├── action: 'add' | 'remove' | 'adjust' | 'return' | 'damage'
      ├── quantityChange: number
      ├── reason: string (optional)
      ├── user: string
      └── timestamp: timestamp
```

### 7. activityLogs
Admin activity audit logs

```
activityLogs/
  ├── {logId}
      ├── id: string (document ID)
      ├── userId: string
      ├── action: string (e.g., 'product_created', 'order_updated')
      ├── resource: string (e.g., 'products', 'orders', 'customers')
      ├── resourceId: string
      ├── changes: object (optional)
      ├── ipAddress: string (optional)
      └── timestamp: timestamp
```

### 8. analytics
Analytics data collection

```
analytics/
  ├── {analyticsId}
      ├── period: string (YYYY-MM)
      ├── totalRevenue: number
      ├── totalOrders: number
      ├── totalCustomers: number
      ├── conversionRate: number
      ├── refundRate: number
      ├── topProducts: { ... }[]
      ├── salesByCategory: { ... }[]
      └── timestamp: timestamp
```

### 9. reports
Financial and operational reports

```
reports/
  ├── {reportId}
      ├── id: string (document ID)
      ├── type: 'sales' | 'financial' | 'inventory' | 'customer'
      ├── period: string (YYYY-MM-DD to YYYY-MM-DD)
      ├── data: object
      ├── createdAt: timestamp
      └── createdBy: string
```

### 10. categories
Product categories

```
categories/
  ├── {categoryId}
      ├── id: string (document ID)
      ├── name: string
      ├── slug: string
      ├── description: string (optional)
      ├── image: string (optional)
      ├── parent: string (optional, for subcategories)
      ├── order: number
      └── isActive: boolean
```

### 11. coupons
Discount coupons collection

```
coupons/
  ├── {couponId}
      ├── id: string (document ID)
      ├── code: string (unique)
      ├── type: 'percentage' | 'fixed' | 'free-shipping'
      ├── value: number
      ├── validFrom: timestamp
      ├── validUntil: timestamp
      ├── maxUses: number (optional)
      ├── usedCount: number
      ├── minPurchase: number (optional)
      ├── applicableCategories: string[] (optional)
      ├── isActive: boolean
      └── createdAt: timestamp
```

### 12. notifications
Notification system

```
notifications/
  ├── {notificationId}
      ├── id: string (document ID)
      ├── userId: string
      ├── type: 'order' | 'inventory' | 'customer' | 'system'
      ├── title: string
      ├── message: string
      ├── data: object (optional)
      ├── read: boolean
      ├── createdAt: timestamp
      └── expiresAt: timestamp (optional)
```

## Indexes

Recommended composite indexes:

1. **orders** - By status and createdAt
2. **products** - By category and status
3. **customers** - By status and registeredAt
4. **inventory** - By status and productId
5. **activityLogs** - By userId and timestamp
6. **activityLogs** - By resource and resourceId

## Storage Buckets

```
gs://project-id.appspot.com/
├── products/
│   ├── {productId}/
│   │   ├── images/
│   │   │   └── {timestamp}-{filename}
│   │   └── variants/
│   │       └── {variantId}/
│   │           └── {timestamp}-{filename}
└── documents/
    ├── reports/
    │   └── {timestamp}-{filename}
    └── exports/
        └── {timestamp}-{filename}
```

## Notes

- All dates should be stored as Firestore timestamps
- SKU and order numbers should be indexed for fast lookups
- Email addresses should be case-insensitive (store lowercase)
- Implement soft deletes where possible (use status field instead of deleting)
- Archive old orders and customers according to retention policy
