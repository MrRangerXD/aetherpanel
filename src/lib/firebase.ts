import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, Auth, UserCredential } from 'firebase/auth';

export interface FirebaseConfig {
  apiKey: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Fallback config from environment variables
const defaultEnvConfig: FirebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || ''
};

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

export function initFirebase(config?: Partial<FirebaseConfig>): { app: FirebaseApp; auth: Auth } | null {
  const finalConfig: FirebaseConfig = {
    apiKey: config?.apiKey || defaultEnvConfig.apiKey,
    authDomain: config?.authDomain || defaultEnvConfig.authDomain || (config?.projectId ? `${config.projectId}.firebaseapp.com` : ''),
    projectId: config?.projectId || defaultEnvConfig.projectId,
    storageBucket: config?.storageBucket || defaultEnvConfig.storageBucket,
    messagingSenderId: config?.messagingSenderId || defaultEnvConfig.messagingSenderId,
    appId: config?.appId || defaultEnvConfig.appId
  };

  if (!finalConfig.apiKey) {
    console.warn('[Firebase] No Firebase API Key provided in config or environment variables.');
    return null;
  }

  try {
    const app = getApps().length === 0 ? initializeApp(finalConfig) : getApp();
    const auth = getAuth(app);
    cachedApp = app;
    cachedAuth = auth;
    return { app, auth };
  } catch (error) {
    console.error('[Firebase] Failed to initialize Firebase SDK:', error);
    return null;
  }
}

export async function signInWithGoogleFirebase(customConfig?: Partial<FirebaseConfig>): Promise<{
  email: string;
  displayName: string;
  photoUrl: string;
  googleId: string;
  idToken?: string;
}> {
  const instance = initFirebase(customConfig);
  if (!instance) {
    throw new Error('Google Firebase Authentication is not configured. Please add your Firebase configuration in the Admin Settings.');
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({
    prompt: 'select_account'
  });

  try {
    const result: UserCredential = await signInWithPopup(instance.auth, provider);
    const fbUser = result.user;

    if (!fbUser.email) {
      throw new Error('No email address returned from Google account.');
    }

    const idToken = await fbUser.getIdToken();

    return {
      email: fbUser.email,
      displayName: fbUser.displayName || fbUser.email.split('@')[0],
      photoUrl: fbUser.photoURL || '',
      googleId: fbUser.uid,
      idToken
    };
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      throw new Error('Sign in was cancelled.');
    }
    if (error.code === 'auth/popup-blocked') {
      throw new Error('The sign-in popup was blocked by your browser. Please allow popups for this site.');
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error('This domain is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.');
    }
    if (error.code === 'auth/invalid-api-key') {
      throw new Error('Invalid Firebase API key provided in settings.');
    }
    throw new Error(error.message || 'Failed to authenticate with Google Firebase.');
  }
}
