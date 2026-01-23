import { Injectable, signal } from '@angular/core';

export type Difficulty = 'normal' | 'hard' | 'nightmare';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private difficultySignal = signal<Difficulty>('normal');

  difficulty(): Difficulty {
    return this.difficultySignal();
  }
  setDifficulty(level: Difficulty) {
    this.difficultySignal.set(level);
  }
  difficultyLabel(): string {
    const d = this.difficultySignal();
    if (d === 'normal') return 'Normal';
    if (d === 'hard') return 'Hard';
    return 'Nightmare';
  }
  getAiReserveBonus(): number {
    const d = this.difficultySignal();
    return d === 'normal' ? 1 : d === 'hard' ? 2 : 3;
  }
  isNightmare(): boolean {
    return this.difficultySignal() === 'nightmare';
  }
}
