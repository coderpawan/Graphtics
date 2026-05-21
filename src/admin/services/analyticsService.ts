/**
 * Admin Analytics Service - Firebase operations for analytics
 */

import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { SalesAnalytics, SalesTrendData } from '../types';

export const analyticsService = {
  // Get sales analytics
  async getSalesAnalytics(dateFrom?: Date, dateTo?: Date): Promise<SalesAnalytics> {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('status', 'in', ['delivered', 'shipped'])
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => doc.data());

      // Filter by date range if provided
      let filteredOrders = orders;
      if (dateFrom && dateTo) {
        filteredOrders = orders.filter((o) => {
          const orderDate = o.createdAt?.toDate?.() || new Date(o.createdAt);
          return orderDate >= dateFrom && orderDate <= dateTo;
        });
      }

      // Calculate metrics
      const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
      const totalOrders = filteredOrders.length;
      const totalCustomers = new Set(filteredOrders.map((o) => o.customerId)).size;
      const averageOrderValue = totalRevenue / totalOrders || 0;

      // Calculate refund rate
      const refundedOrders = filteredOrders.filter((o) => o.paymentStatus === 'refunded').length;
      const refundRate = (refundedOrders / totalOrders) * 100 || 0;

      // Get top products (simplified - would need product sales data)
      const topProducts = filteredOrders
        .flatMap((o) => o.items || [])
        .reduce((acc, item) => {
          const existing = acc.find((p: any) => p.productId === item.productId);
          if (existing) {
            existing.unitsSold += item.quantity;
            existing.revenue += item.subtotal;
          } else {
            acc.push({
              productId: item.productId,
              productName: item.productName,
              unitsSold: item.quantity,
              revenue: item.subtotal,
              returnRate: 0,
            });
          }
          return acc;
        }, [])
        .sort((a: any, b: any) => b.revenue - a.revenue)
        .slice(0, 10);

      // Calculate sales trend
      const salesTrend: SalesTrendData[] = [];
      const dailySales: { [key: string]: any } = {};

      filteredOrders.forEach((order) => {
        const date = order.createdAt?.toDate?.() || new Date(order.createdAt);
        const dateStr = date.toISOString().split('T')[0];

        if (!dailySales[dateStr]) {
          dailySales[dateStr] = {
            date: dateStr,
            sales: 0,
            orders: 0,
            revenue: 0,
          };
        }

        dailySales[dateStr].sales += 1;
        dailySales[dateStr].orders += 1;
        dailySales[dateStr].revenue += order.total || 0;
      });

      Object.values(dailySales).forEach((day: any) => {
        salesTrend.push(day);
      });

      // Calculate conversion rate (simplified)
      const conversionRate = (totalOrders / (totalCustomers * 5)) * 100 || 0; // Rough estimate

      return {
        totalRevenue,
        totalOrders,
        totalCustomers,
        averageOrderValue,
        conversionRate,
        refundRate,
        topProducts,
        salesByCategory: [], // Would need separate implementation
        salesTrend: salesTrend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      };
    } catch (error) {
      console.error('Error fetching sales analytics:', error);
      throw error;
    }
  },

  // Get revenue trend
  async getRevenueTrend(days = 30) {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('status', 'in', ['delivered', 'shipped']),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => doc.data());

      const now = new Date();
      const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const filteredOrders = orders.filter((o) => {
        const orderDate = o.createdAt?.toDate?.() || new Date(o.createdAt);
        return orderDate >= pastDate && orderDate <= now;
      });

      const dailyRevenue: { [key: string]: number } = {};

      filteredOrders.forEach((order) => {
        const date = order.createdAt?.toDate?.() || new Date(order.createdAt);
        const dateStr = date.toISOString().split('T')[0];
        dailyRevenue[dateStr] = (dailyRevenue[dateStr] || 0) + (order.total || 0);
      });

      return Object.entries(dailyRevenue).map(([date, revenue]) => ({
        date,
        revenue,
      }));
    } catch (error) {
      console.error('Error fetching revenue trend:', error);
      throw error;
    }
  },

  // Get customer acquisition
  async getCustomerAcquisition(days = 30) {
    try {
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, orderBy('registeredAt', 'desc'));

      const snapshot = await getDocs(q);
      const customers = snapshot.docs.map((doc) => doc.data());

      const now = new Date();
      const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const dailyAcquisition: { [key: string]: number } = {};

      customers.forEach((customer) => {
        const regDate = customer.registeredAt?.toDate?.() || new Date(customer.registeredAt);
        if (regDate >= pastDate && regDate <= now) {
          const dateStr = regDate.toISOString().split('T')[0];
          dailyAcquisition[dateStr] = (dailyAcquisition[dateStr] || 0) + 1;
        }
      });

      return Object.entries(dailyAcquisition).map(([date, count]) => ({
        date,
        newCustomers: count,
      }));
    } catch (error) {
      console.error('Error fetching customer acquisition:', error);
      throw error;
    }
  },

  // Get product performance
  async getProductPerformance(limit = 10) {
    try {
      const productsRef = collection(db, 'products');
      const q = query(productsRef, where('status', '==', 'published'), orderBy('createdAt', 'desc'));

      const snapshot = await getDocs(q);
      const products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return products
        .map((p) => ({
          productId: p.id,
          productName: p.name,
          views: p.views || 0,
          sales: p.unitsSold || 0,
          revenue: (p.unitsSold || 0) * (p.price?.retail || 0),
          conversionRate: p.views ? ((p.unitsSold || 0) / p.views) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching product performance:', error);
      throw error;
    }
  },

  // Get category performance
  async getCategoryPerformance() {
    try {
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef,
        where('status', 'in', ['delivered', 'shipped'])
      );

      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map((doc) => doc.data());

      const categoryPerformance: { [key: string]: { sales: number; revenue: number } } = {};

      orders.forEach((order) => {
        order.items?.forEach((item: any) => {
          const category = item.category || 'uncategorized';
          if (!categoryPerformance[category]) {
            categoryPerformance[category] = { sales: 0, revenue: 0 };
          }
          categoryPerformance[category].sales += item.quantity || 1;
          categoryPerformance[category].revenue += item.subtotal || 0;
        });
      });

      const total = Object.values(categoryPerformance).reduce((sum, cat) => sum + cat.revenue, 0);

      return Object.entries(categoryPerformance).map(([category, data]) => ({
        category,
        ...data,
        percentage: total ? (data.revenue / total) * 100 : 0,
      }));
    } catch (error) {
      console.error('Error fetching category performance:', error);
      throw error;
    }
  },
};
