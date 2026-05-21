# Admin Panel System Documentation

## Overview

This is a comprehensive, enterprise-grade admin panel system for managing a clothing e-commerce business. It provides complete functionality for product management, order processing, customer management, inventory tracking, analytics, and financial reporting.

## Features

### 1. **Dashboard**
- Real-time business metrics (revenue, orders, customers, inventory)
- Low stock alerts
- Pending orders overview
- Top performing products
- Quick access to key modules

### 2. **Product Management**
- Complete CRUD operations for products
- Multiple product images with upload to Firebase Storage
- Product variants (size, color, etc.)
- SKU and barcode management
- Clothing-specific attributes (gender, material, fit type, etc.)
- Category and subcategory management
- SEO metadata management
- Inventory tracking
- Pricing and discount management
- Bulk operations

### 3. **Order Management**
- Order creation and tracking
- Order status management (pending, processing, shipped, delivered, returned, cancelled)
- Payment status tracking
- Return request handling
- Invoice generation
- Shipment tracking with carrier integration
- Customer communication history
- Refund processing

### 4. **Customer Management**
- Customer profile viewing
- Order history
- Address management
- Wishlist tracking
- Customer segmentation (VIP, regular, inactive, suspended, blocked)
- Communication preferences
- Lifetime value calculation

### 5. **Inventory Management**
- Real-time stock tracking
- Low stock alerts
- Out of stock management
- SKU management
- Batch inventory updates
- Audit logging for inventory changes
- Reorder level management
- Warehouse location tracking

### 6. **Analytics & Reporting**
- Sales analytics and trends
- Revenue tracking
- Product performance analysis
- Customer acquisition metrics
- Category performance
- Top-selling products
- Conversion rate tracking
- Refund analysis

### 7. **Financial Reports**
- Revenue reports
- Expense tracking
- Profit calculations
- Tax calculations
- Refund accounting
- Period-based reports
- Export to CSV/JSON

### 8. **Activity & Audit Logging**
- Track all admin actions
- User activity history
- Resource change history
- Timestamp and IP logging
- Compliance reporting

## Project Structure

```
src/admin/
├── components/
│   ├── layout/
│   │   ├── AdminLayout.tsx        # Main layout wrapper
│   │   ├── AdminSidebar.tsx       # Side navigation
│   │   └── AdminHeader.tsx        # Top navigation
│   └── shared/
│       ├── DataTable.tsx          # Reusable table component
│       └── Components.tsx         # StatCard, Form, Modal, Button, Badge
├── context/
│   └── AdminContext.tsx           # Admin auth and state context
├── pages/
│   ├── dashboard/
│   │   └── AdminDashboard.tsx
│   ├── products/
│   │   └── ProductsList.tsx
│   ├── orders/
│   │   └── OrdersList.tsx
│   ├── customers/
│   │   └── CustomersList.tsx
│   ├── inventory/
│   │   └── InventoryList.tsx
│   ├── analytics/
│   │   └── AnalyticsDashboard.tsx
│   ├── reports/                   # Coming soon
│   └── settings/                  # Coming soon
├── routes/
│   ├── AdminRoutes.tsx            # Routing configuration
│   └── AdminProtectedRoute.tsx    # Role-based protection
├── services/
│   ├── productService.ts          # Product CRUD operations
│   ├── orderService.ts            # Order management
│   ├── customerService.ts         # Customer operations
│   ├── inventoryService.ts        # Stock management
│   ├── analyticsService.ts        # Analytics data
│   ├── activityService.ts         # Audit logging
│   ├── reportService.ts           # Report generation
│   └── storageService.ts          # File uploads
├── store/
│   └── adminStore.ts              # Zustand state management
├── hooks/
│   └── useAdmin.ts                # Custom React hooks
├── types/
│   └── index.ts                   # TypeScript definitions
├── utils/
│   └── helpers.ts                 # Utility functions
├── firebase.rules                 # Firestore security rules
├── FIRESTORE_SCHEMA.md           # Database schema
└── README.md                      # This file
```

## Getting Started

### 1. Setup Firebase

#### Create Firestore Collections

Use the Firebase Console to create the following collections:

- `admins` - Admin users
- `products` - Product catalog
- `orders` - Customer orders
- `customers` - Customer profiles
- `inventory` - Stock management
- `inventoryAuditLogs` - Inventory audit trail
- `activityLogs` - Admin activity logs
- `analytics` - Analytics data
- `reports` - Generated reports
- `categories` - Product categories
- `coupons` - Discount coupons
- `notifications` - System notifications

See `FIRESTORE_SCHEMA.md` for detailed schema information.

#### Deploy Security Rules

1. Update `firebase/firestore.rules` with the content from `src/admin/firebase.rules`
2. Deploy to Firebase:

```bash
firebase deploy --only firestore:rules
```

#### Setup Storage Buckets

Create the following folder structure in Firebase Storage:

```
products/
  └── {productId}/
      ├── images/
      └── variants/
documents/
  ├── reports/
  └── exports/
```

### 2. Create Admin Users

Add admin documents to the `admins` collection:

```javascript
{
  id: "user-id",
  email: "admin@example.com",
  name: "Admin Name",
  role: "super-admin",
  permissions: [
    {
      id: "all",
      name: "All Permissions",
      resource: "*",
      action: "*"
    }
  ],
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 3. Access the Admin Panel

Navigate to: `http://localhost:4173/admin`

Login with your admin account and you'll be directed to the dashboard.

## Admin Roles & Permissions

### Roles

1. **Super Admin**
   - Full access to all modules
   - Can manage other admin users
   - Can modify system settings

2. **Product Manager**
   - Can create, read, update, delete products
   - Can manage categories and tags
   - Can handle product images and variants

3. **Inventory Manager**
   - Can view and update inventory
   - Can set reorder levels
   - Can view audit logs
   - Cannot delete products

4. **Finance Manager**
   - Can view orders and financial data
   - Can generate financial reports
   - Can view analytics
   - Cannot modify orders or products

5. **Customer Support**
   - Can view customer profiles
   - Can view and update orders
   - Can manage customer information
   - Cannot access financial data

### Permission Matrix

| Feature | Super Admin | Product Mgr | Inventory Mgr | Finance Mgr | Support |
|---------|------------|-------------|---------------|------------|---------|
| Products | ✓ | ✓ | - | - | - |
| Orders | ✓ | - | - | ✓ | ✓ |
| Customers | ✓ | - | - | - | ✓ |
| Inventory | ✓ | - | ✓ | - | - |
| Analytics | ✓ | - | - | ✓ | - |
| Reports | ✓ | - | - | ✓ | - |
| Settings | ✓ | - | - | - | - |

## API/Service Layer

### Using Services

```typescript
import { productService, orderService } from '@/admin/services';

// Get products
const products = await productService.getProducts({ status: 'published' });

// Get specific product
const product = await productService.getProduct(productId);

// Create product
const newProduct = await productService.createProduct({
  name: 'T-Shirt',
  sku: 'TSH-001',
  category: 'Shirts',
  price: { retail: 29.99, cost: 10.00 },
  // ... other fields
});

// Update product
await productService.updateProduct(productId, { status: 'draft' });

// Delete product (soft delete - archives)
await productService.deleteProduct(productId);

// Get orders
const orders = await orderService.getOrders({ status: 'pending' });

// Update order status
await orderService.updateOrderStatus(orderId, 'shipped');
```

### Using Hooks

```typescript
import { useAdminProducts, useAdminOrders, useAdminCustomers } from '@/admin/hooks/useAdmin';

function MyComponent() {
  const { products, loading, error } = useAdminProducts({ status: 'published' });
  const { orders } = useAdminOrders({ status: 'pending' });
  const { customers } = useAdminCustomers();

  return (
    // Use the data
  );
}
```

## Components

### Shared Components

#### StatCard
Display key metrics with icons and trends

```tsx
<StatCard
  label="Total Revenue"
  value="$42,500"
  icon={DollarSign}
  trend="up"
  change="12% from last month"
  color="green"
/>
```

#### DataTable
Reusable data table with sorting, searching, and actions

```tsx
<DataTable
  columns={columns}
  data={products}
  loading={loading}
  searchPlaceholder="Search products..."
  onExport={handleExport}
/>
```

#### Modal
Reusable modal dialog

```tsx
<Modal
  isOpen={isOpen}
  title="Add Product"
  onClose={handleClose}
  size="lg"
  footer={
    <>
      <Button variant="secondary" onClick={handleClose}>Cancel</Button>
      <Button onClick={handleSubmit}>Add Product</Button>
    </>
  }
>
  {/* Modal content */}
</Modal>
```

#### Button
Customizable button component

```tsx
<Button variant="primary" size="lg" loading={isLoading}>
  Save Changes
</Button>
```

## Utilities

### Helper Functions

```typescript
import { formatCurrency, formatDate, calculateProfitMargin, validateProduct, exportToCSV } from '@/admin/utils/helpers';

// Format currency
formatCurrency(1000); // "$1,000.00"

// Format date
formatDate(new Date()); // "Jan 15, 2024"

// Calculate profit margin
calculateProfitMargin(10, 25); // 60%

// Validate product
const validation = validateProduct(productData);
if (!validation.valid) {
  console.log(validation.errors);
}

// Export data to CSV
exportToCSV(products, 'products.csv');

// Export data to JSON
exportToJSON(orders, 'orders.json');
```

## State Management

Using Zustand for global state:

```typescript
import { useAdminStore } from '@/admin/store/adminStore';

function MyComponent() {
  const { products, setProducts, addProduct } = useAdminStore();
  
  const handleAddProduct = async () => {
    const newProduct = await productService.createProduct(data);
    addProduct(newProduct);
  };

  return (
    // Component JSX
  );
}
```

## Firebase Integration

### Authentication

The admin system uses Firebase Authentication. Admin status is verified by checking the user's record in the `admins` collection.

```typescript
// Check if user is admin
const { adminUser, isAdmin, hasPermission } = useAdminAuth();

// Check permission
if (hasPermission('products', 'create')) {
  // User can create products
}
```

### Firestore Operations

All CRUD operations use Firestore SDK with proper security rules:

```typescript
// Secure queries only return data the user has permission to access
// based on role and permissions

// Example: Only product managers can see draft products
const drafts = await productService.getProducts({ status: 'draft' });
```

### Storage Operations

File uploads are validated and optimized:

```typescript
// Validate file
const validation = storageService.validateFile(file);

// Upload with compression
const url = await storageService.uploadProductImage(productId, file);

// Delete file
await storageService.deleteProductImage(url);
```

## Security Features

1. **Role-Based Access Control (RBAC)**
   - Admin roles with specific permissions
   - Route protection based on roles
   - Operation validation at service layer

2. **Firebase Security Rules**
   - Document-level access control
   - Field-level permissions
   - Audit logging of all changes

3. **Activity Logging**
   - All admin actions are logged
   - Change history for audit trail
   - User tracking

4. **Data Validation**
   - Input validation using Zod
   - File type and size validation
   - Business logic validation

5. **CSRF/XSS Protection**
   - React built-in protection
   - Content Security Policy
   - Input sanitization

## Performance Optimization

1. **Lazy Loading**
   - Admin pages are lazy loaded
   - Reduces initial bundle size

2. **Code Splitting**
   - Separate bundles for admin and customer sites

3. **Pagination**
   - Large datasets are paginated
   - Configurable page size

4. **Image Optimization**
   - Automatic image compression
   - Multiple size variants

5. **Caching**
   - Local state management
   - Firebase optimizations

6. **Debounced Search**
   - Reduces API calls
   - Improves responsiveness

## Database Queries

### Example Queries

```typescript
// Get all published products in a category
const products = await productService.getProductsByCategory('shirts');

// Get low stock products
const lowStock = await productService.getLowStockProducts(10);

// Get top selling products
const topProducts = await productService.getTopSellingProducts(10);

// Get pending orders
const pendingOrders = await orderService.getPendingOrders();

// Get customer orders
const customerOrders = await orderService.getOrdersByCustomer(customerId);

// Get VIP customers
const vipCustomers = await customerService.getVIPCustomers(5000);

// Get inventory statistics
const stats = await inventoryService.getInventoryStatistics();

// Get activity logs
const logs = await activityService.getActivityLogs(50);

// Generate sales analytics
const analytics = await analyticsService.getSalesAnalytics(startDate, endDate);
```

## Extending the Admin Panel

### Adding a New Module

1. Create service file: `src/admin/services/newModuleService.ts`
2. Add types: Update `src/admin/types/index.ts`
3. Create pages: `src/admin/pages/newModule/`
4. Add routes: Update `src/admin/routes/AdminRoutes.tsx`
5. Add navigation: Update `src/admin/components/layout/AdminSidebar.tsx`

### Adding a Custom Component

```typescript
// src/admin/components/custom/MyComponent.tsx
export function MyComponent() {
  return (
    // Component JSX
  );
}
```

### Adding Custom Hooks

```typescript
// src/admin/hooks/useCustom.ts
export function useCustomData() {
  // Hook logic
}
```

## Troubleshooting

### Admin Not Seeing Data

1. Check admin user exists in `admins` collection
2. Verify Firebase security rules are deployed
3. Check browser console for errors
4. Verify user has correct role

### Permission Denied Errors

1. Check user's role and permissions
2. Verify Firebase security rules
3. Check if operation requires specific permission
4. Review activity logs for denied operations

### Images Not Uploading

1. Check Firebase Storage rules allow writes
2. Verify file size is under limit (5MB)
3. Check file type is allowed
4. Verify Firebase Storage quota

### Slow Performance

1. Check network tab for slow requests
2. Review Firestore indexes
3. Enable pagination for large datasets
4. Use debouncing for search

## Best Practices

1. **Always validate input** before sending to database
2. **Use TypeScript** for type safety
3. **Log important actions** for audit trail
4. **Handle errors gracefully** with user feedback
5. **Optimize queries** with proper indexes
6. **Test role-based access** thoroughly
7. **Keep sensitive data** secure with proper rules
8. **Monitor performance** with Firestore insights

## Future Enhancements

- [ ] Advanced analytics with charts (Chart.js, Recharts)
- [ ] Email notifications for orders and inventory
- [ ] SMS notifications
- [ ] Bulk product import/export
- [ ] Advanced customer segmentation
- [ ] Marketing campaign management
- [ ] Supplier management
- [ ] Returns management system
- [ ] Staff management & scheduling
- [ ] Multi-warehouse support
- [ ] API integration (Shopify, WooCommerce)
- [ ] Mobile app for on-the-go management

## Support & Documentation

For more information, see:
- `FIRESTORE_SCHEMA.md` - Database schema details
- `firebase.rules` - Security rules
- Individual service files for detailed API documentation

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Maintained by:** Development Team
