/**
 * Admin Activity Service - Firebase operations for activity logging
 */

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { ActivityLog } from '../types';

const COLLECTION = 'activityLogs';

export const activityService = {
  // Log activity
  async logActivity(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    changes?: Record<string, any>
  ) {
    try {
      const log: Omit<ActivityLog, 'id'> = {
        userId,
        action,
        resource,
        resourceId,
        changes,
        timestamp: new Date(),
      };

      const docRef = await addDoc(collection(db, COLLECTION), log);

      return {
        id: docRef.id,
        ...log,
      } as ActivityLog;
    } catch (error) {
      console.error('Error logging activity:', error);
      throw error;
    }
  },

  // Get activity logs
  async getActivityLogs(limit_count = 50) {
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(limit_count)
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ActivityLog));
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  },

  // Get user activity logs
  async getUserActivityLogs(userId: string, limit_count = 50) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('userId', '==', userId),
        orderBy('timestamp', 'desc'),
        limit(limit_count)
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ActivityLog));
    } catch (error) {
      console.error('Error fetching user activity logs:', error);
      throw error;
    }
  },

  // Get activity logs for resource
  async getResourceActivityLogs(resource: string, resourceId: string) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('resource', '==', resource),
        where('resourceId', '==', resourceId),
        orderBy('timestamp', 'desc')
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ActivityLog));
    } catch (error) {
      console.error('Error fetching resource activity logs:', error);
      throw error;
    }
  },

  // Get activity by action
  async getActivityByAction(action: string, limit_count = 50) {
    try {
      const q = query(
        collection(db, COLLECTION),
        where('action', '==', action),
        orderBy('timestamp', 'desc'),
        limit(limit_count)
      );

      const snapshot = await getDocs(q);

      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ActivityLog));
    } catch (error) {
      console.error('Error fetching activity by action:', error);
      throw error;
    }
  },

  // Get activity summary
  async getActivitySummary(hoursBack = 24) {
    try {
      const q = query(
        collection(db, COLLECTION),
        orderBy('timestamp', 'desc'),
        limit(1000)
      );

      const snapshot = await getDocs(q);
      const allLogs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as ActivityLog));

      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      const recentLogs = allLogs.filter((log) => log.timestamp > cutoffTime);

      const summary = {
        totalActivities: recentLogs.length,
        byAction: {} as Record<string, number>,
        byResource: {} as Record<string, number>,
        byUser: {} as Record<string, number>,
      };

      recentLogs.forEach((log) => {
        summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;
        summary.byResource[log.resource] = (summary.byResource[log.resource] || 0) + 1;
        summary.byUser[log.userId] = (summary.byUser[log.userId] || 0) + 1;
      });

      return summary;
    } catch (error) {
      console.error('Error fetching activity summary:', error);
      throw error;
    }
  },
};
