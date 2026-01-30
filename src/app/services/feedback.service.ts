import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore, collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { environmentFirebase } from '../../environments/environment.firebase';

export interface Feedback {
  userId: string;
  userName: string;
  userPhoto: string;
  text: string;
  rating: number;
  timestamp?: any;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private db: Firestore;
  private auth: Auth;

  constructor() {
    const app = initializeApp(environmentFirebase);
    this.db = getFirestore(app);
    this.auth = getAuth(app);
  }

  async addFeedback(data: Feedback): Promise<void> {
    const payload = {
      ...data,
      rating: Math.max(1, Math.min(5, Math.floor(data.rating))),
      text: (data.text ?? '').slice(0, 500),
      timestamp: serverTimestamp()
    };
    await addDoc(collection(this.db, 'feedbacks'), payload);
  }

  async getRecentFeedbacks(count: number): Promise<Feedback[]> {
    const q = query(
      collection(this.db, 'feedbacks'),
      orderBy('timestamp', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data() as Feedback);
  }

  async getFeedbackPage(count: number, cursor?: QueryDocumentSnapshot<DocumentData> | null): Promise<{ items: Feedback[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null }> {
    const base = [
      orderBy('timestamp', 'desc'),
      limit(count)
    ] as any[];
    const q = cursor
      ? query(collection(this.db, 'feedbacks'), orderBy('timestamp', 'desc'), startAfter(cursor), limit(count))
      : query(collection(this.db, 'feedbacks'), orderBy('timestamp', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(d => d.data() as Feedback);
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    return { items, lastDoc };
  }
  async canUserPostToday(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const q = query(
      collection(this.db, 'feedbacks'),
      where('userId', '==', userId),
      where('timestamp', '>=', since)
    );
    const snapshot = await getDocs(q);
    const count = snapshot.size;
    const cap = 3;
    return { allowed: count < cap, remaining: Math.max(0, cap - count) };
  }
}
