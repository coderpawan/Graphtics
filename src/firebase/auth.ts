import {
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  sendEmailVerification,
  signOut,
  reauthenticateWithCredential,
  updatePassword,
  User,
} from 'firebase/auth';
import { auth } from './config';

const googleProvider = new GoogleAuthProvider();

export const loginWithEmail = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const registerWithEmail = async (email: string, password: string) => {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(userCredential.user);
  return userCredential;
};
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const sendResetLink = (email: string) => sendPasswordResetEmail(auth, email);
export const logout = () => signOut(auth);
export const getCurrentUser = (): User | null => auth.currentUser;

export const changePassword = async (currentPassword: string, newPassword: string) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error('No authenticated user available for password change.');
  }

  const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
  await reauthenticateWithCredential(currentUser, credential);
  await updatePassword(currentUser, newPassword);
};
