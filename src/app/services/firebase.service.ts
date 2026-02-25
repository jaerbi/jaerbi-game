import { Injectable, signal, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, Firestore, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
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

export interface TowerDefenseScore {
    userId: string;
    displayName: string;
    maxWave: number;
    totalMoney: number;
    mapSize: string;
    gridSize?: number;
    userTotalXp?: number;
    timestamp?: any;
}

export interface MasteryProfile {
    totalXp: number;
    usedPoints: number;
    upgrades: { [key: string]: number };
    completedLevelIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class FirebaseService {
    private db: Firestore | null = null;
    private auth: Auth | null = null;
    private loadedMasteriesUserId: string | null = null;

    user$ = signal<User | null>(null);
    masteryProfile = signal<MasteryProfile | null>(null);

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
                    if (user) {
                        if (this.loadedMasteriesUserId !== user.uid || !this.masteryProfile()) {
                            this.loadTowerDefenseMasteries(user.uid);
                        }
                    } else {
                        this.masteryProfile.set(null);
                        this.loadedMasteriesUserId = null;
                    }
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

    async saveTowerDefenseScore(entry: TowerDefenseScore): Promise<void> {
        if (!this.db) return;
        try {
            console.count('FIREBASE_CALL: saveTowerDefenseScore');
            let userTotalXp: number | undefined = undefined;
            if (entry.userId) {
                try {
                    const ref = doc(this.db, 'towerDefenseMasteries', entry.userId);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        const data = snap.data() as any;
                        const xp = data && typeof data.totalXp === 'number' ? data.totalXp : 0;
                        userTotalXp = xp;
                    }
                } catch {
                    userTotalXp = undefined;
                }
            }
            const payload = {
                ...entry,
                userTotalXp,
                timestamp: serverTimestamp()
            };
            await addDoc(collection(this.db, 'towerDefenseLeaderboards'), payload);
        } catch (e) {
            console.error('Error adding TD score: ', e);
        }
    }

    async getTopTowerDefenseScores(limitCount: number, size: number): Promise<TowerDefenseScore[]> {
        if (!this.db) return [];
        const querySize = `${size}x${size}`;
        try {
            // First get raw list
            const q = query(
                collection(this.db, 'towerDefenseLeaderboards'),
                where('mapSize', '==', querySize),
                orderBy('maxWave', 'desc'),
                limit(limitCount * 4) // Fetch more to filter duplicates
            );
            const querySnapshot = await getDocs(q);
            const allScores = querySnapshot.docs.map(doc => doc.data() as TowerDefenseScore);

            // Filter to keep only best per user
            const bestPerUser = new Map<string, TowerDefenseScore>();
            for (const s of allScores) {
                if (!bestPerUser.has(s.userId)) {
                    bestPerUser.set(s.userId, s);
                } else {
                    const existing = bestPerUser.get(s.userId)!;
                    if (s.maxWave > existing.maxWave) {
                        bestPerUser.set(s.userId, s);
                    }
                }
            }
            
            return Array.from(bestPerUser.values())
                .sort((a, b) => b.maxWave - a.maxWave)
                .slice(0, limitCount);

        } catch (e) {
            console.error('Error fetching TD scores: ', e);
            return [];
        }
    }

    async getMyTowerDefenseHistory(userId: string, limitCount: number): Promise<TowerDefenseScore[]> {
        if (!this.db) return [];
        try {
            const q = query(
                collection(this.db, 'towerDefenseLeaderboards'),
                where('userId', '==', userId),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data() as TowerDefenseScore);
        } catch (e) {
            console.error('Error fetching my TD history: ', e);
            return [];
        }
    }

    async getUserBestTowerDefenseScore(userId: string, size: number): Promise<TowerDefenseScore | null> {
        if (!this.db) return null;
        const querySize = `${size}x${size}`;
        try {
            const q = query(
                collection(this.db, 'towerDefenseLeaderboards'),
                where('userId', '==', userId),
                where('mapSize', '==', querySize),
                orderBy('maxWave', 'desc'),
                orderBy('timestamp', 'desc'),
                limit(1)
            );
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) {
                return null;
            }
            return querySnapshot.docs[0].data() as TowerDefenseScore;
        } catch {
            return null;
        }
    }

    private async loadTowerDefenseMasteries(userId: string): Promise<void> {
        if (!this.db) return;
        if (this.loadedMasteriesUserId === userId && this.masteryProfile()) return;
        try {
            console.count('FIREBASE_CALL: loadTowerDefenseMasteries');
            const ref = doc(this.db, 'towerDefenseMasteries', userId);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const data = snap.data() as any;
                const profile: MasteryProfile = {
                    totalXp: typeof data.totalXp === 'number' ? data.totalXp : 0,
                    usedPoints: typeof data.usedPoints === 'number' ? data.usedPoints : 0,
                    upgrades: data.upgrades && typeof data.upgrades === 'object' ? data.upgrades as { [key: string]: number } : {},
                    completedLevelIds: Array.isArray(data.completedLevelIds) ? data.completedLevelIds : []
                };
                this.masteryProfile.set(profile);
            } else {
                const profile: MasteryProfile = { totalXp: 0, usedPoints: 0, upgrades: {} };
                await setDoc(ref, { userId, ...profile });
                this.masteryProfile.set(profile);
            }
            this.loadedMasteriesUserId = userId;
        } catch (e) {
            console.error('Error loading TD mastery profile: ', e);
        }
    }

    setMasteryProfile(profile: MasteryProfile) {
        this.masteryProfile.set(profile);
    }

    async saveTowerDefenseMasteries(): Promise<void> {
        if (!this.db) return;
        const user = this.user$();
        const profile = this.masteryProfile();
        if (!user || !profile) return;
        try {
            console.count('FIREBASE_CALL: saveTowerDefenseMasteries');
            const ref = doc(this.db, 'towerDefenseMasteries', user.uid);
            await setDoc(ref, { userId: user.uid, ...profile }, { merge: true });
        } catch (e) {
            console.error('Error saving TD mastery profile: ', e);
        }
    }

    async awardTowerDefenseXp(xp: number, levelId?: string, wave?: number): Promise<void> {
        if (!this.db) return;

        if (xp <= 0) return;

        const user = this.user$();

        if (!user) return;

        /**
         * CALCULATION LOGIC AND LIMITS (Sanity Check):
         * 1. Campaign: XP is fixed (e.g. Level 5 = 40 XP).
         * 2. Random Mode: XP = (Wave * 1.5) + Bonus.
         * - Bonus is awarded after wave 20: (Wave - 20) * 2.
         * * CALCULATION EXAMPLES:
         * - Wave 10: (10 * 1.5) = 15 XP
         * - Wave 20: (20 * 1.5) = 30 XP
         * - Wave 40: (40 * 1.5) + (20 * 2) = 60 + 40 = 100 XP
         * - Wave 80: (80 * 1.5) + (60 * 2) = 120 + 120 = 240 XP (Limit Limit)
         * * LIMIT: 250 XP per session is a safe maximum.
         */
        const HARD_CAP = 250;

        // Dynamic check: if more than HARD_CAP allows has arrived
        if (xp > HARD_CAP) {
            console.error(`Security Alert: XP Award Rejected. Attempted: ${xp}, Max Allowed: ${HARD_CAP}`);
            return;
        }

        try {
            console.count('FIREBASE_CALL: awardTowerDefenseXp');
            const current = this.masteryProfile() ?? { totalXp: 0, usedPoints: 0, upgrades: {}, completedLevelIds: [] };

            // Preventing XP re-farming for campaign levels
            if (levelId && current.completedLevelIds?.includes(levelId)) {
                console.warn(`XP skipped: Level ${levelId} already completed.`);
                return;
            }

            const nextCompleted = levelId && !current.completedLevelIds?.includes(levelId)
                ? [...(current.completedLevelIds || []), levelId]
                : current.completedLevelIds;

            const next: MasteryProfile = {
                totalXp: current.totalXp + xp,
                usedPoints: current.usedPoints,
                upgrades: current.upgrades,
                completedLevelIds: nextCompleted
            };

            const ref = doc(this.db, 'towerDefenseMasteries', user.uid);
            await setDoc(ref, { userId: user.uid, ...next }, { merge: true });
            this.masteryProfile.set(next);

        } catch (e) {
            console.error('Error awarding TD XP: ', e);
        }
    }

    async saveBalanceLogs(logs: any[]): Promise<void> {
        if (!this.db || logs.length === 0) return;
        try {
            console.count('FIREBASE_CALL: saveBalanceLogs');
            // Batch write? Or simple loop. Logs are usually 1-7 items.
            // Using batch is safer for consistency but simple adds are fine here.
            const batch = [];
            for (const log of logs) {
                // Add timestamp if missing or ensure it's serverTimestamp?
                // The log already has a timestamp.
                batch.push(addDoc(collection(this.db, 'balance_logs'), log));
            }
            await Promise.all(batch);
        } catch (e) {
            console.error('Error saving balance logs: ', e);
        }
    }
}
