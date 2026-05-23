import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  getUserProfile,
  syncUserProfile,
  updateUserAddresses,
  updateUserCommunicationPreferences,
  updateUserNotifications,
  updateUserPreferences,
  updateUserWishlist,
} from '../firebase/firestore';
import { changePassword, loginWithEmail, loginWithGoogle, registerWithEmail, sendResetLink, logout as firebaseLogout } from '../firebase/auth';
import { uploadProfileImage } from '../firebase/storage';
import type { Address, NotificationSettings, UserPreferences, UserProfile } from '../types';
import { useToast } from '../components/ui/Toast';

const LOCAL_STORAGE_KEY = 'graphtics_user';
const PENDING_PROFILE_KEY = 'graphtics_pending_profile_sync';

const loadStoredUser = (): UserProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
};

/**
 * True when Firestore / network indicates the client cannot reach the backend right now.
 * Avoid treating unrelated Firestore codes (e.g. failed-precondition for missing indexes) as "offline".
 */
const isFirestoreUnreachableError = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  const message = String((error as Error)?.message ?? '');
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    message.toLowerCase().includes('client is offline') ||
    message.toLowerCase().includes('failed to get document because the client is offline')
  );
};

const retryWithBackoff = async <T,>(fn: () => Promise<T>, maxAttempts = 3, baseDelay = 800): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

const defaultProfileFromAuth = (firebaseUser: FirebaseUser): UserProfile => ({
  uid: firebaseUser.uid,
  name: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'Guest',
  email: firebaseUser.email ?? '',
  phone: firebaseUser.phoneNumber ?? '',
  phoneAlt: '',
  avatarUrl: '',
  gender: 'other',
  dob: '',
  createdAt: new Date().toISOString(),
  membershipStatus: 'bronze',
  role: 'customer',
  wishlist: [],
  recentlyViewed: [],
  savedAddresses: [],
  preferences: {
    savedSizes: [],
    preferredFit: 'regular',
    preferredBrands: [],
    preferredColors: [],
    preferredStyles: [],
    favouriteCategories: [],
  },
  notifications: {
    pushNotifications: true,
    orderAlerts: true,
    marketing: false,
  },
  communicationPreferences: {
    emailUpdates: true,
    smsUpdates: false,
    offers: true,
    restockAlerts: true,
  },
  loginHistory: [],
});

type AuthContextValue = {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, phone: string, phoneAlt?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (profile: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  saveAddresses: (addresses: Address[]) => Promise<void>;
  savePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  saveNotificationSettings: (notifications: Partial<NotificationSettings>) => Promise<void>;
  saveCommunicationPreferences: (preferences: Partial<UserProfile['communicationPreferences']>) => Promise<void>;
  toggleWishlist: (productId: string) => Promise<void>;
  isAdmin: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(loadStoredUser());
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const uidRef = useRef<string | null>(null);

  const storePendingSync = (profile: UserProfile) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(profile));
    }
  };

  const getPendingSync = (): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  };

  const clearPendingSync = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PENDING_PROFILE_KEY);
    }
  };

  /** Loads / creates Firestore profile and updates React state (call after UI is already unblocked). */
  const syncProfileWithServer = async (firebaseUser: FirebaseUser) => {
    try {
      const existing = await retryWithBackoff(() => getUserProfile(firebaseUser.uid), 3, 600);

      const profile: UserProfile = existing
        ? {
            ...defaultProfileFromAuth(firebaseUser),
            ...existing,
            wishlist: existing.wishlist ?? [],
            recentlyViewed: existing.recentlyViewed ?? [],
          }
        : {
            ...defaultProfileFromAuth(firebaseUser),
            createdAt: new Date().toISOString(),
          };

      if (!existing) {
        await retryWithBackoff(() => syncUserProfile(profile), 2, 500);
      }

      if (uidRef.current !== firebaseUser.uid) return;

      setUser({ ...profile, isOffline: false });
      clearPendingSync();
    } catch (error) {
      if (uidRef.current !== firebaseUser.uid) return;

      if (isFirestoreUnreachableError(error) || (typeof navigator !== 'undefined' && !navigator.onLine)) {
        const cached = loadStoredUser();
        const fallback =
          cached?.uid === firebaseUser.uid ? { ...cached, isOffline: true } : { ...defaultProfileFromAuth(firebaseUser), isOffline: true };
        setUser(fallback);
        storePendingSync(fallback);
        return;
      }

      console.error('Profile sync error:', error);
      toast.showToast('Unable to refresh profile from the server.', 'error');
    }
  };

  const syncPendingProfile = async () => {
    const pendingProfile = getPendingSync();
    if (!pendingProfile || !navigator.onLine) return;
    try {
      await retryWithBackoff(() => syncUserProfile(pendingProfile), 3, 1000);
      const refreshedProfile = await retryWithBackoff(() => getUserProfile(pendingProfile.uid), 3, 1000);
      if (refreshedProfile && uidRef.current === pendingProfile.uid) {
        setUser({ ...refreshedProfile, isOffline: false });
        clearPendingSync();
      }
    } catch (error) {
      console.error('Failed to sync pending profile:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, currentUser => {
      if (!currentUser) {
        uidRef.current = null;
        setUser(null);
        setLoading(false);
        return;
      }

      uidRef.current = currentUser.uid;

      const cached = loadStoredUser();
      if (cached?.uid === currentUser.uid) {
        setUser(cached);
      } else {
        setUser(defaultProfileFromAuth(currentUser));
      }

      setLoading(false);

      void syncProfileWithServer(currentUser);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      void syncPendingProfile();
    };

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      const credential = await loginWithEmail(email, password);
      const firebaseUser = credential.user;
      if (firebaseUser) {
        await syncProfileWithServer(firebaseUser);
      }
      toast.showToast('Signed in successfully', 'success');
    } catch (error) {
      toast.showToast('Unable to sign in. Check your credentials.', 'error');
      throw error;
    }
  };

  const signUp = async (name: string, email: string, password: string, phone: string, phoneAlt?: string) => {
    try {
      const userCredential = await registerWithEmail(email, password);
      const profile: UserProfile = {
        ...defaultProfileFromAuth(userCredential.user),
        name,
        email,
        phone: phone.trim(),
        phoneAlt: phoneAlt?.trim() || '',
        createdAt: new Date().toISOString(),
      };
      await syncUserProfile(profile);
      setUser(profile);
      toast.showToast('Welcome to Graphtics. Please verify your email.', 'success');
    } catch (error) {
      toast.showToast('Unable to create account. Try again.', 'error');
      throw error;
    }
  };

  const signOut = async () => {
    await firebaseLogout();
    setUser(null);
    clearPendingSync();
    toast.showToast('Signed out successfully', 'info');
  };

  const signInWithGoogle = async () => {
    try {
      const credential = await loginWithGoogle();
      const firebaseUser = credential.user;
      if (firebaseUser) {
        await syncProfileWithServer(firebaseUser);
      }
      toast.showToast('Signed in with Google', 'success');
    } catch (error) {
      toast.showToast('Google login failed', 'error');
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    await sendResetLink(email);
    toast.showToast('Password reset link sent to your email', 'success');
  };

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    const updatedProfile = { ...user, ...profileData };
    await syncUserProfile(updatedProfile);
    setUser(updatedProfile);
    toast.showToast('Profile updated', 'success');
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    try {
      const url = await uploadProfileImage(user.uid, file);
      const updatedProfile = { ...user, avatarUrl: url };
      await syncUserProfile(updatedProfile);
      setUser(updatedProfile);
      toast.showToast('Profile image updated', 'success');
    } catch (error) {
      toast.showToast('Unable to upload profile image', 'error');
      throw error;
    }
  };

  const changePasswordHandler = async (currentPassword: string, newPassword: string) => {
    try {
      await changePassword(currentPassword, newPassword);
      toast.showToast('Password updated successfully', 'success');
    } catch (error) {
      toast.showToast('Password update failed. Please try again.', 'error');
      throw error;
    }
  };

  const saveAddresses = async (addresses: Address[]) => {
    if (!user) return;
    const updatedProfile = { ...user, savedAddresses: addresses };
    await updateUserAddresses(user.uid, addresses);
    setUser(updatedProfile);
    toast.showToast('Addresses saved', 'success');
  };

  const savePreferences = async (preferences: Partial<UserPreferences>) => {
    if (!user) return;
    const updatedProfile = { ...user, preferences: { ...user.preferences, ...preferences } };
    await updateUserPreferences(user.uid, updatedProfile.preferences);
    setUser(updatedProfile);
    toast.showToast('Preferences updated', 'success');
  };

  const saveNotificationSettings = async (notifications: Partial<NotificationSettings>) => {
    if (!user) return;
    const updatedProfile = { ...user, notifications: { ...user.notifications, ...notifications } };
    await updateUserNotifications(user.uid, updatedProfile.notifications);
    setUser(updatedProfile);
    toast.showToast('Notification settings updated', 'success');
  };

  const saveCommunicationPreferences = async (preferences: Partial<UserProfile['communicationPreferences']>) => {
    if (!user) return;
    const updatedProfile = { ...user, communicationPreferences: { ...user.communicationPreferences, ...preferences } };
    await updateUserCommunicationPreferences(user.uid, updatedProfile.communicationPreferences);
    setUser(updatedProfile);
    toast.showToast('Communication preferences saved', 'success');
  };

  const toggleWishlist = async (productId: string) => {
    if (!user) {
      toast.showToast('Log in to save favorites', 'info');
      return;
    }

    const currentWishlist = user.wishlist ?? [];
    const isAdding = !currentWishlist.includes(productId);
    try {
      await updateUserWishlist(user.uid, productId, isAdding);
    } catch (error) {
      console.error('Wishlist update failed:', error);
      toast.showToast('Could not update your wishlist. Check your connection and try again.', 'error');
      return;
    }

    const updatedProfile = {
      ...user,
      wishlist: isAdding ? [...currentWishlist, productId] : currentWishlist.filter(id => id !== productId),
    };

    setUser(updatedProfile);
    toast.showToast(isAdding ? 'Added to wishlist' : 'Removed from wishlist', 'success');
  };

  const isAdmin = useMemo(() => {
    return ['super-admin', 'staff', 'designer', 'inventory-manager'].includes(user?.role ?? '');
  }, [user?.role]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        resetPassword,
        updateProfile,
        uploadAvatar,
        changePassword: changePasswordHandler,
        saveAddresses,
        savePreferences,
        saveNotificationSettings,
        saveCommunicationPreferences,
        toggleWishlist,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
