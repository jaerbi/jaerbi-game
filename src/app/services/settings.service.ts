import { Injectable, signal } from '@angular/core';
import { translate, TranslationKey, LangCode } from '../i18n/translations';

export type Difficulty = 'baby' | 'normal' | 'hard' | 'nightmare';
export type MapSize = 10 | 20 | 30;

export interface GameSettings {
    gridSize: number;
    difficulty: Difficulty;
    language: LangCode;
    customMode: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
    private difficultySignal = signal<Difficulty>('normal');
    private mapSizeSignal = signal<MapSize>(10);
    private langSignal = signal<LangCode>('uk');
    private customModeSignal = signal<boolean>(false);
    public version = 'v.2.7.6';
    public diffArr: Difficulty[] = ['baby', 'normal', 'hard', 'nightmare'];
    private storageKey = 'shape_tactics_settings';

    constructor() {
        this.loadSettings();
    }

    difficulty(): Difficulty {
        return this.difficultySignal();
    }
    setDifficulty(level: Difficulty) {
        this.difficultySignal.set(level);
        this.persistSettings();
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
        this.persistSettings();
    }
    mapSizeLabel(): string {
        return `${this.mapSizeSignal()}x${this.mapSizeSignal()}`;
    }

    currentLang(): LangCode {
        return this.langSignal();
    }
    setLang(lang: LangCode) {
        this.langSignal.set(lang);
        this.persistSettings();
    }
    t(key: TranslationKey): string {
        return translate(key, this.langSignal());
    }
    customMode(): boolean {
        return this.customModeSignal();
    }
    setCustomMode(active: boolean) {
        this.customModeSignal.set(active);
        this.persistSettings();
    }

    private loadSettings() {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<GameSettings> | null;
            if (!parsed || typeof parsed !== 'object') return;
            const diffs: Difficulty[] = ['baby', 'normal', 'hard', 'nightmare'];
            const sizes: MapSize[] = [10, 20, 30];
            const langs: LangCode[] = ['en', 'uk'];
            const diff = parsed.difficulty && diffs.includes(parsed.difficulty as Difficulty) ? parsed.difficulty as Difficulty : this.difficultySignal();
            const size = parsed.gridSize && sizes.includes(parsed.gridSize as MapSize) ? parsed.gridSize as MapSize : this.mapSizeSignal();
            const lang = parsed.language && langs.includes(parsed.language as LangCode) ? parsed.language as LangCode : this.langSignal();
            this.difficultySignal.set(diff);
            this.mapSizeSignal.set(size as MapSize);
            this.langSignal.set(lang);
            this.customModeSignal.set(!!parsed.customMode);
        } catch {}
    }

    private persistSettings() {
        if (typeof window === 'undefined') return;
        try {
            const payload: GameSettings = {
                gridSize: this.mapSizeSignal(),
                difficulty: this.difficultySignal(),
                language: this.langSignal(),
                customMode: this.customModeSignal()
            };
            localStorage.setItem(this.storageKey, JSON.stringify(payload));
        } catch {}
    }
}
