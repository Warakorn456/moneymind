import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyBerBLvPkLPbPAgXxrMSm3iZR8M5PVBzic',
  authDomain: 'moneymind-d97f3.firebaseapp.com',
  projectId: 'moneymind-d97f3',
  storageBucket: 'moneymind-d97f3.firebasestorage.app',
  messagingSenderId: '668138190451',
  appId: '1:668138190451:web:d181da0bf022bcc0c09c06',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
export const auth = getAuth(app);
