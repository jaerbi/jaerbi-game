import { Injectable, signal } from '@angular/core';

export type Difficulty = 'baby' | 'normal' | 'hard' | 'nightmare';
export type MapSize = 10 | 20 | 30;

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private difficultySignal = signal<Difficulty>('normal');
    private mapSizeSignal = signal<MapSize>(10);
    public version = 'version: 0.4.0';

    difficulty(): Difficulty {
        return this.difficultySignal();
    }
    setDifficulty(level: Difficulty) {
        this.difficultySignal.set(level);
    }
    difficultyLabel(): string {
        const d = this.difficultySignal();
        if (d === 'baby') return 'Baby';
        if (d === 'normal') return 'Normal';
        if (d === 'hard') return 'Hard';
        return 'Nightmare';
    }
    getAiReserveBonus(turn: number): number {
        const d = this.difficultySignal();
        const isEvenTurn = turn % 2 === 0;
        return d === 'baby' ? (isEvenTurn ? 1 : 0) : d === 'normal' ? 1 : d === 'hard' ? 2 : 3;
    }
    isHard(): boolean {
        return this.difficultySignal() === 'hard';
    }
    isNightmare(): boolean {
        return this.difficultySignal() === 'nightmare';
    }
    // Map Size
    mapSize(): number {
        return this.mapSizeSignal();
    }
    setMapSize(size: MapSize) {
        this.mapSizeSignal.set(size);
    }
    mapSizeLabel(): string {
        return `${this.mapSizeSignal()}x${this.mapSizeSignal()}`;
    }
}
