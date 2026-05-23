/**
 * Categories & catalog metadata stored in a single Firestore document.
 * Path: metadata/categories
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { StoreCategoryMetadata } from '../types/store';

const DOC_PATH = ['metadata', 'categories'] as const;

const defaultMetadata: StoreCategoryMetadata = {
  mainCategories: [],
  subcategories: {},
};

export const metadataService = {
  async getCategories(): Promise<StoreCategoryMetadata> {
    const ref = doc(db, DOC_PATH[0], DOC_PATH[1]);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { ...defaultMetadata };
    }
    const data = snap.data() as Partial<StoreCategoryMetadata>;
    return {
      mainCategories: Array.isArray(data.mainCategories) ? data.mainCategories : [],
      subcategories:
        data.subcategories && typeof data.subcategories === 'object' ? data.subcategories : {},
    };
  },

  async saveCategories(metadata: StoreCategoryMetadata): Promise<void> {
    const ref = doc(db, DOC_PATH[0], DOC_PATH[1]);
    await setDoc(
      ref,
      {
        ...metadata,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  },
};
