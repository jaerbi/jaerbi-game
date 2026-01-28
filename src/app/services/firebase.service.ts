import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, Firestore } from 'firebase/firestore';
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
}

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  private db: Firestore;

  constructor() {
    const app = initializeApp(environmentFirebase);
    this.db = getFirestore(app);
  }

  async saveHighScore(score: ScoreEntry): Promise<void> {
    try {
      await addDoc(collection(this.db, 'highscores'), score);
    } catch (e) {
      console.error('Error adding document: ', e);
    }
  }

  async getTopScores(limitCount: number, difficulty: Difficulty, mapSize: MapSize): Promise<ScoreEntry[]> {
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
}
