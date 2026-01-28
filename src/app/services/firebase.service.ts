import { Injectable } from '@angular/core';

export interface ScoreEntry {
  playerName: string;
  turnsPlayed: number;
  forestsCaptured: number;
  victoryType: 'Monopoly' | 'Annihilation';
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  async saveHighScore(score: ScoreEntry): Promise<void> {
    console.log('[FirebaseMock] saveHighScore', score);
  }

  async getTopScores(limit: number): Promise<ScoreEntry[]> {
    console.log('[FirebaseMock] getTopScores', { limit });
    return [];
  }
}
