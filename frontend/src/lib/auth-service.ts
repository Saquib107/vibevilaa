import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  User,
} from 'firebase/auth';
import { auth, firestore } from '@/config/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  photoURL?: string;
  provider: 'email' | 'google';
  role: 'user' | 'admin';
  coins: number;
  gems: number;
  followers: number;
  following: number;
  bio?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const authService = {
  async signUpWithEmail(
    email: string,
    password: string,
    fullName: string,
    username: string
  ): Promise<User> {
    // Check if username exists
    const usersRef = collection(firestore, 'users');
    const q = query(usersRef, where('username', '==', username.toLowerCase()));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      throw new Error('Username already exists');
    }

    // Check if email exists
    const emailQuery = query(usersRef, where('email', '==', email.toLowerCase()));
    const emailSnapshot = await getDocs(emailQuery);

    if (!emailSnapshot.empty) {
      throw new Error('Email already registered');
    }

    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Create user profile in Firestore
    const userProfile: UserProfile = {
      uid: user.uid,
      fullName,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      provider: 'email',
      role: 'user',
      coins: 100,
      gems: 10,
      followers: 0,
      following: 0,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await setDoc(doc(firestore, 'users', user.uid), userProfile);

    return user;
  },

  async signInWithEmail(email: string, password: string): Promise<User> {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  },

  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Try to create/fetch user profile, but don't block login if Firestore is offline
      try {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnapshot = await getDoc(userDocRef);

        if (!userDocSnapshot.exists()) {
          // Create user profile for new Google users
          const userProfile: UserProfile = {
            uid: user.uid,
            fullName: user.displayName || 'User',
            username: `user_${user.uid.slice(0, 8)}`,
            email: user.email || '',
            photoURL: user.photoURL || undefined,
            provider: 'google',
            role: 'user',
            coins: 100,
            gems: 10,
            followers: 0,
            following: 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };

          await setDoc(userDocRef, userProfile);
        }
      } catch (firestoreError) {
        console.warn('Firestore offline or failed, but user is authenticated:', firestoreError);
      }

      return user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  },

  async handleGoogleRedirect(): Promise<User | null> {
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const user = result.user;

        // Try to create/fetch user profile, but don't block login if Firestore is offline
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDocSnapshot = await getDoc(userDocRef);

          if (!userDocSnapshot.exists()) {
            const userProfile: UserProfile = {
              uid: user.uid,
              fullName: user.displayName || 'User',
              username: `user_${user.uid.slice(0, 8)}`,
              email: user.email || '',
              photoURL: user.photoURL || undefined,
              provider: 'google',
              role: 'user',
              coins: 100,
              gems: 10,
              followers: 0,
              following: 0,
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
            };

            await setDoc(userDocRef, userProfile);
          }
        } catch (firestoreError) {
          console.warn('Firestore offline or failed on redirect, but user is authenticated:', firestoreError);
        }

        return user;
      }
      return null;
    } catch (error) {
      console.error('Google redirect error:', error);
      throw error;
    }
  },

  async signOut(): Promise<void> {
    await signOut(auth);
  },

  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const userDocRef = doc(firestore, 'users', uid);
      const userDocSnapshot = await getDoc(userDocRef);

      if (userDocSnapshot.exists()) {
        return userDocSnapshot.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  },
};
