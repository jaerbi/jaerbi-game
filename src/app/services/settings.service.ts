import { Injectable, signal } from '@angular/core';
import { translate, TranslationKey, LangCode } from '../i18n/translations';

export type Difficulty = 'baby' | 'normal' | 'hard' | 'nightmare';
export type MapSize = 10 | 20 | 30;

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private difficultySignal = signal<Difficulty>('normal');
    private mapSizeSignal = signal<MapSize>(10);
    private langSignal = signal<LangCode>('uk');
    public version = 'v.0.5.2';
    public diffArr: Difficulty[] = ['baby', 'normal', 'hard', 'nightmare'];

    difficulty(): Difficulty {
        return this.difficultySignal();
    }
    setDifficulty(level: Difficulty) {
        this.difficultySignal.set(level);
    }
    difficultyLabel(): TranslationKey {
        const d = this.difficultySignal();
        return this.getDifficultyLabel(d);
    }
    getDifficultyLabel(diff: Difficulty): TranslationKey {
        if (diff === 'baby') return 'BABY';
        if (diff === 'normal') return 'NORMAL';
        if (diff === 'hard') return 'HARD';
        return 'NIGHTMARE';
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

    currentLang(): LangCode {
        return this.langSignal();
    }
    setLang(lang: LangCode) {
        this.langSignal.set(lang);
    }
    t(key: TranslationKey): string {
        return translate(key, this.langSignal());
    }
}
