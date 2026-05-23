/**
 * Admin Analytics — aggregates over `orders` / `products` using the clothing store schema.
 */

import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { CategorySales, ProductSales, SalesAnalytics, SalesTrendData } from '../types';
import type { StoreOrder } from '../types/store';
import { productService } from './productService';
import { mapOrderRecordFromFirestore } from './orderService';
import { isAwaitingShipment } from '../../lib/orderFirestoreStatus';

function toDate(value: unknown): Date {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(String(value));
}

function mapOrderDoc(docSnap: { id: string; data: () => Record<string, unknown> }): StoreOrder {
  return mapOrderRecordFromFirestore(docSnap.id, docSnap.data());
}

function filterOrdersByRange(orders: StoreOrder[], from?: Date, to?: Date): StoreOrder[] {
  if (!from || !to) return orders;
  return orders.filter((o) => {
    const d = toDate(o.createdAt);
    return d >= from && d <= to;
  });
}

export const analyticsService = {
  async getSalesAnalytics(dateFrom?: Date, dateTo?: Date): Promise<SalesAnalytics> {
    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1500))
    );
    let orders = ordersSnap.docs.map(mapOrderDoc);
    orders = filterOrdersByRange(orders, dateFrom, dateTo);

    const counted = orders.filter(
      (o) => o.paymentStatus === 'paid' && ['shipped', 'delivered'].includes(o.status)
    );

    const totalRevenue = counted.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrders = counted.length;
    const totalCustomers = new Set(counted.map((o) => o.customerId)).size;
    const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    const refunded = orders.filter((o) => o.status === 'returned').length;
    const refundRate = orders.length ? (refunded / orders.length) * 100 : 0;

    const topProducts: ProductSales[] = counted
      .flatMap((o) => o.items || [])
      .reduce<ProductSales[]>((acc, item) => {
        const lineTotal = item.price * item.quantity;
        const existing = acc.find((p) => p.productId === item.productId);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += lineTotal;
        } else {
          acc.push({
            productId: item.productId,
            productName: item.sku || item.productId,
            unitsSold: item.quantity,
            revenue: lineTotal,
            returnRate: 0,
          });
        }
        return acc;
      }, [])
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const dailySales: Record<string, SalesTrendData> = {};
    counted.forEach((order) => {
      const date = toDate(order.createdAt);
      const dateStr = date.toISOString().split('T')[0];
      if (!dailySales[dateStr]) {
        dailySales[dateStr] = { date: dateStr, sales: 0, orders: 0, revenue: 0 };
      }
      dailySales[dateStr].sales += 1;
      dailySales[dateStr].orders += 1;
      dailySales[dateStr].revenue += order.totalAmount || 0;
    });

    const salesTrend = Object.values(dailySales).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const categoryMap: Record<string, { sales: number; revenue: number }> = {};
    counted.forEach((order) => {
      order.items?.forEach((item) => {
        const cats =
          item.categories && item.categories.length ? item.categories : ['Uncategorized'];
        cats.forEach((cat) => {
          if (!categoryMap[cat]) categoryMap[cat] = { sales: 0, revenue: 0 };
          categoryMap[cat].sales += item.quantity;
          categoryMap[cat].revenue += item.price * item.quantity;
        });
      });
    });
    const totalCatRev = Object.values(categoryMap).reduce((s, c) => s + c.revenue, 0);
    const salesByCategory: CategorySales[] = Object.entries(categoryMap).map(([category, v]) => ({
      category,
      sales: v.revenue,
      percentage: totalCatRev ? (v.revenue / totalCatRev) * 100 : 0,
    }));

    const conversionRate = totalCustomers ? Math.min(100, (totalOrders / (totalCustomers * 4)) * 100) : 0;

    return {
      totalRevenue,
      totalOrders,
      totalCustomers,
      averageOrderValue,
      conversionRate,
      refundRate,
      topProducts,
      salesByCategory,
      salesTrend,
    };
  },

  async getDashboardSnapshot(): Promise<{
    revenue: number;
    orderCount: number;
    outOfStockSkus: number;
    pendingShippingCount: number;
  }> {
    const snap = await getDocs(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(1200))
    );
    const orders = snap.docs.map(mapOrderDoc);
    const fulfilled = orders.filter(
      (o) => o.paymentStatus === 'paid' && ['shipped', 'delivered'].includes(o.status)
    );
    const revenue = fulfilled.reduce((s, o) => s + (o.totalAmount || 0), 0);
    const orderCount = fulfilled.length;
    const pendingShippingCount = orders.filter((o) => isAwaitingShipment(o.status)).length;
    const outOfStockSkus = await productService.countOutOfStockSkus();
    return {
      revenue,
      orderCount,
      outOfStockSkus,
      pendingShippingCount,
    };
  },
};
