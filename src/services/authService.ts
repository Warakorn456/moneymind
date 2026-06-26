import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export async function loginWithUsername(username: string, password: string): Promise<string> {
  // Lookup email from members collection
  const memberRef = doc(db, 'members', username);
  const memberSnap = await getDoc(memberRef);

  let email = '';
  if (memberSnap.exists()) {
    email = memberSnap.data().email || '';
  }
  if (!email) {
    email = `${username}@moneymind.local`;
  }

  // Try sign in first, then create if not found
  let uid = '';
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    uid = cred.user.uid;
  } catch (e: any) {
    if (
      e.code === 'auth/user-not-found' ||
      e.code === 'auth/invalid-credential' ||
      e.code === 'auth/invalid-login-credentials'
    ) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      uid = cred.user.uid;
    } else {
      throw e;
    }
  }

  // Update uid in members
  await setDoc(memberRef, { uid, username }, { merge: true });
  return username;
}
