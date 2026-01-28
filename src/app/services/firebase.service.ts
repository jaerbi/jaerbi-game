import { Injectable, signal, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, Firestore } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { environmentFirebase } from '../../environments/environment.firebase';
import { Difficulty, MapSize } from './settings.service';

export interface ScoreEntry {
  playerName: string;
  turnsPlayed: number;
  forestsCaptured: number;
  victoryType: 'Monopoly' | 'Annihilation';
  timestamp: number;
  difficulty: Difficulty;
  mapSize: MapSize;
  victory: boolean;
  userId?: string;
  userPhoto?: string;
}

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private db: Firestore | null = null;
  private auth: Auth | null = null;
  
  user$ = signal<User | null>(null);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    const app = initializeApp(environmentFirebase);
    // Initialize Firestore safely
    try {
        this.db = getFirestore(app);
    } catch (e) {
        console.warn('Firestore init failed (likely SSR)', e);
    }

    // Initialize Auth only in browser
    if (isPlatformBrowser(this.platformId)) {
      try {
        this.auth = getAuth(app);
        onAuthStateChanged(this.auth, (user) => {
          this.user$.set(user);
        });
      } catch (e) {
        console.warn('Auth init failed', e);
      }
    }
  }

  async loginWithGoogle() {
    if (!this.auth || !isPlatformBrowser(this.platformId)) return;
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(this.auth, provider);
    } catch (e) {
      console.error('Login failed', e);
    }
  }

  async logout() {
    if (!this.auth) return;
    await signOut(this.auth);
  }

  async saveHighScore(score: ScoreEntry): Promise<void> {
    if (!this.db) return;
    try {
      await addDoc(collection(this.db, 'highscores'), score);
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  }

  async getTopScores(limitCount: number, difficulty: Difficulty, mapSize: MapSize): Promise<ScoreEntry[]> {
    if (!this.db) return [];
    try {
      const q = query(
        collection(this.db, 'highscores'),
        where('difficulty', '==', difficulty),
        where('mapSize', '==', mapSize),
        orderBy('victory', 'desc'),
        orderBy('turnsPlayed', 'asc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ScoreEntry);
    } catch (e) {
      console.error('Error fetching scores: ', e);
      return [];
    }
  }

  async getUserScores(userId: string): Promise<ScoreEntry[]> {
    if (!this.db) return [];
    try {
      const q = query(
        collection(this.db, 'highscores'),
        where('userId', '==', userId),
        where('victory', '==', true),
        orderBy('turnsPlayed', 'asc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as ScoreEntry);
    } catch (e) {
      console.error('Error fetching user scores: ', e);
      return [];
    }
  }
}
