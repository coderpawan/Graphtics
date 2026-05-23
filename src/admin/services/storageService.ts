/**
 * Admin Storage Service - Firebase storage operations for admin uploads
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '../../firebase/config';

export const storageService = {
  /**
   * Upload to `products/{productId}/...` with progress callbacks (0–100).
   */
  async uploadProductImageWithProgress(
    productId: string,
    file: File,
    onProgress?: (pct: number) => void,
    variantId?: string
  ): Promise<string> {
    const compressedFile = (await this.compressImage(file)) as File | Blob;
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const path = variantId
      ? `products/${productId}/variants/${variantId}/${filename}`
      : `products/${productId}/images/${filename}`;

    const fileRef = ref(storage, path);
    const task = uploadBytesResumable(fileRef, compressedFile);

    return new Promise((resolve, reject) => {
      task.on(
        'state_changed',
        (snap) => {
          const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
          onProgress?.(pct);
        },
        (err) => reject(err),
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          onProgress?.(100);
          resolve(url);
        }
      );
    });
  },

  /**
   * Review photos shown on the storefront (admin-curated only).
   */
  async uploadProductReviewPhoto(productId: string, file: File): Promise<string> {
    const compressedFile = await this.compressImage(file);
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const path = `products/${productId}/review-photos/${filename}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, compressedFile);
    return getDownloadURL(fileRef);
  },

  async uploadOrderPackagePhoto(orderDocId: string, file: File): Promise<string> {
    const v = this.validateFile(file);
    if (!v.valid) throw new Error(v.error ?? 'Invalid file');
    const compressedFile = await this.compressImage(file);
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const path = `orders/${orderDocId}/package-tracking/${filename}`;
    const fileRef = ref(storage, path);
    await uploadBytes(fileRef, compressedFile);
    return getDownloadURL(fileRef);
  },

  // Upload product image
  async uploadProductImage(
    productId: string,
    file: File,
    variantId?: string
  ): Promise<string> {
    try {
      // Compress image if possible
      const compressedFile = await this.compressImage(file);

      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const path = variantId
        ? `products/${productId}/variants/${variantId}/${filename}`
        : `products/${productId}/images/${filename}`;

      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, compressedFile);
      const url = await getDownloadURL(fileRef);

      return url;
    } catch (error) {
      console.error('Error uploading product image:', error);
      throw error;
    }
  },

  // Upload multiple product images
  async uploadProductImages(
    productId: string,
    files: File[]
  ): Promise<string[]> {
    try {
      const uploadPromises = files.map((file, index) =>
        this.uploadProductImage(productId, file).catch((err) => {
          console.error(`Error uploading image ${index}:`, err);
          return null;
        })
      );

      const urls = await Promise.all(uploadPromises);
      return urls.filter((url): url is string => url !== null);
    } catch (error) {
      console.error('Error uploading multiple images:', error);
      throw error;
    }
  },

  // Upload document
  async uploadDocument(
    folder: string,
    file: File
  ): Promise<string> {
    try {
      const timestamp = Date.now();
      const filename = `${timestamp}-${file.name}`;
      const path = `documents/${folder}/${filename}`;

      const fileRef = ref(storage, path);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      return url;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  // Delete file
  async deleteFile(path: string): Promise<void> {
    try {
      const fileRef = ref(storage, path);
      await deleteObject(fileRef);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  },

  /**
   * Deletes a file from Firebase Storage when `url` is a download URL from this bucket.
   * No-op when the URL cannot be parsed (e.g. external CDN). Throws on permission/network errors.
   */
  async deleteProductImage(url: string): Promise<void> {
    const path = this.extractPathFromURL(url);
    if (!path) return;
    await this.deleteFile(path);
  },

  // Compress image
  async compressImage(file: File): Promise<File | Blob> {
    return new Promise((resolve) => {
      // Skip compression for small files
      if (file.size < 100000) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down if larger than 1920x1080
          if (width > 1920 || height > 1080) {
            const aspectRatio = width / height;
            if (width > height) {
              width = 1920;
              height = width / aspectRatio;
            } else {
              height = 1080;
              width = height * aspectRatio;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, { type: file.type });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            }, file.type, 0.8);
          } else {
            resolve(file);
          }
        };

        img.onerror = () => {
          resolve(file);
        };
      };

      reader.onerror = () => {
        resolve(file);
      };
    });
  },

  // Extract path from Firebase Storage URL
  extractPathFromURL(url: string): string | null {
    try {
      const decodedUrl = decodeURIComponent(url);
      const pathMatch = decodedUrl.match(/\/o\/(.*)\?alt=/);
      return pathMatch ? pathMatch[1] : null;
    } catch {
      return null;
    }
  },

  // Get file size
  async getFileSize(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      const size = response.headers.get('content-length');
      return size ? parseInt(size, 10) : 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  },

  // Validate file
  validateFile(
    file: File,
    allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: number = 5 * 1024 * 1024 // 5MB
  ): { valid: boolean; error?: string } {
    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
      };
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size exceeds ${maxSize / (1024 * 1024)}MB limit`,
      };
    }

    return { valid: true };
  },
};
