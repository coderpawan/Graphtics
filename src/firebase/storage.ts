import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './config';

export const uploadProfileImage = async (uid: string, file: File): Promise<string> => {
  const imageRef = ref(storage, `users/${uid}/profile.jpg`);
  await uploadBytes(imageRef, file);
  return getDownloadURL(imageRef);
};
