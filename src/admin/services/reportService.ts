/**
 * Admin Reports Service - Firebase operations for reports
 */

import { collection, query, where, getDocs, addDoc, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { FinancialReport } from '../types';
import { orderService } from './orderService';
import { coerceDate } from '../utils/helpers';
import type { StoreOrder } from '../types/store';

const COLLECTION = 'reports';

export const reportService = {
  // Generate sales report
  async generateSalesReport(
    startDate: Date,
    endDate: Date
  ) {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('status', 'in', ['delivered', 'shipped']),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => doc.data());

      // Filter by date range
      const filteredOrders = orders.filter((o) => {
        const orderDate = o.createdAt?.toDate?.() || new Date(o.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      });

      const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalOrders = filteredOrders.length;
      const totalCustomers = new Set(filteredOrders.map((o) => o.customerId)).size;

      return {
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        totalOrders,
        totalRevenue,
        totalCustomers,
        averageOrderValue: totalRevenue / totalOrders || 0,
        topProducts: this.extractTopProducts(filteredOrders),
        dailyBreakdown: this.getDailyBreakdown(filteredOrders),
      };
    } catch (error) {
      console.error('Error generating sales report:', error);
      throw error;
    }
  },

  // Generate financial report
  async generateFinancialReport(
    startDate: Date,
    endDate: Date
  ): Promise<FinancialReport> {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => doc.data());

      const filteredOrders = orders.filter((o) => {
        const orderDate = o.createdAt?.toDate?.() || new Date(o.createdAt);
        return orderDate >= startDate && orderDate <= endDate;
      });

      const revenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const tax = filteredOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
      const refunds = filteredOrders
        .filter((o) => o.paymentStatus === 'refunded')
        .reduce((sum, o) => sum + (o.total || 0), 0);

      // Estimate expenses (rough calculation)
      const expenses = revenue * 0.4; // 40% cost of goods sold assumption
      const profit = revenue - expenses - tax;

      return {
        id: `report-${Date.now()}`,
        period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
        revenue,
        expenses,
        profit,
        tax,
        refunds,
        breakdown: [
          { category: 'Revenue', amount: revenue, percentage: 100 },
          { category: 'COGS', amount: expenses, percentage: (expenses / revenue) * 100 },
          { category: 'Tax', amount: tax, percentage: (tax / revenue) * 100 },
          { category: 'Profit', amount: profit, percentage: (profit / revenue) * 100 },
        ],
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error generating financial report:', error);
      throw error;
    }
  },

  // Generate inventory report
  async generateInventoryReport() {
    try {
      const inventoryRef = collection(db, 'inventory');
      const q = query(inventoryRef);

      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => doc.data());

      const totalValue = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.productPrice || 0), 0);
      const lowStockItems = items.filter((i) => i.status === 'low-stock').length;
      const outOfStockItems = items.filter((i) => i.status === 'out-of-stock').length;

      return {
        totalItems: items.length,
        totalValue,
        lowStockItems,
        outOfStockItems,
        inStockItems: items.filter((i) => i.status === 'in-stock').length,
        topValue: items
          .sort((a, b) => (b.quantity * (b.productPrice || 0)) - (a.quantity * (a.productPrice || 0)))
          .slice(0, 10),
      };
    } catch (error) {
      console.error('Error generating inventory report:', error);
      throw error;
    }
  },

  // Generate customer report
  async generateCustomerReport() {
    try {
      const customersRef = collection(db, 'customers');
      const q = query(customersRef);

      const snapshot = await getDocs(q);
      const customers = snapshot.docs.map((doc) => doc.data());

      const totalCustomers = customers.length;
      const activeCustomers = customers.filter((c) => c.status === 'active').length;
      const totalSpent = customers.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
      const avgLifetimeValue = totalSpent / totalCustomers || 0;

      // VIP customers (high spenders)
      const vipCustomers = customers
        .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 10);

      return {
        totalCustomers,
        activeCustomers,
        inactiveCustomers: customers.filter((c) => c.status === 'inactive').length,
        suspendedCustomers: customers.filter((c) => c.status === 'suspended').length,
        blockedCustomers: customers.filter((c) => c.status === 'blocked').length,
        totalSpent,
        averageLifetimeValue: avgLifetimeValue,
        vipCustomers,
      };
    } catch (error) {
      console.error('Error generating customer report:', error);
      throw error;
    }
  },

  // Save report
  async saveReport(
    type: string,
    period: string,
    data: any
  ) {
    try {
      const docRef = await addDoc(collection(db, COLLECTION), {
        type,
        period,
        data,
        createdAt: new Date(),
        createdBy: 'admin', // Should be replaced with actual user
      });

      return {
        id: docRef.id,
        type,
        period,
        data,
        createdAt: new Date(),
      };
    } catch (error) {
      console.error('Error saving report:', error);
      throw error;
    }
  },

  // Get reports
  async getReports(type?: string, limit_count = 50) {
    try {
      const constraints = [];

      if (type) {
        constraints.push(where('type', '==', type));
      }

      constraints.push(orderBy('createdAt', 'desc'));
      constraints.push(limit(limit_count));

      const q = query(collection(db, COLLECTION), ...constraints);
      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  },

  // Helper functions
  extractTopProducts(orders: any[]) {
    const productMap = new Map();

    orders.forEach((order) => {
      order.items?.forEach((item: any) => {
        const key = item.productId;
        if (!productMap.has(key)) {
          productMap.set(key, {
            productName: item.productName,
            unitsSold: 0,
            revenue: 0,
          });
        }
        const product = productMap.get(key);
        product.unitsSold += item.quantity || 1;
        product.revenue += item.subtotal || 0;
      });
    });

    return Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  },

  getDailyBreakdown(orders: any[]) {
    const breakdown: Record<string, any> = {};

    orders.forEach((order) => {
      const date = order.createdAt?.toDate?.() || new Date(order.createdAt);
      const dateStr = date.toISOString().split('T')[0];

      if (!breakdown[dateStr]) {
        breakdown[dateStr] = {
          date: dateStr,
          orders: 0,
          revenue: 0,
          customers: new Set(),
        };
      }

      breakdown[dateStr].orders += 1;
      breakdown[dateStr].revenue += order.total || 0;
      breakdown[dateStr].customers.add(order.customerId);
    });

    return Object.values(breakdown).map((day: any) => ({
      date: day.date,
      orders: day.orders,
      revenue: day.revenue,
      uniqueCustomers: day.customers.size,
    }));
  },

  /** CSV export for historical orders (clothing store schema). */
  async buildOrdersCsvForRange(startDate: Date, endDate: Date): Promise<string> {
    const orders = await orderService.listOrdersBetweenDates(startDate, endDate);
    const headers = [
      'orderId',
      'customerId',
      'customerName',
      'totalAmount',
      'paymentStatus',
      'status',
      'trackingNumber',
      'createdAt',
      'itemsJson',
    ];
    const esc = (v: string) => {
      if (v.includes(',') || v.includes('"') || v.includes('\n')) {
        return `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    };
    const lines = [
      headers.join(','),
      ...orders.map((o: StoreOrder) =>
        [
          esc(o.orderId),
          esc(o.customerId),
          esc(o.customerName),
          String(o.totalAmount ?? 0),
          esc(String(o.paymentStatus ?? '')),
          esc(String(o.status ?? '')),
          esc(String(o.trackingNumber ?? '')),
          esc(coerceDate(o.createdAt).toISOString()),
          esc(JSON.stringify(o.items ?? [])),
        ].join(',')
      ),
    ];
    return lines.join('\n');
  },
};
