import { Injectable, signal, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, orderBy, limit, getDocs, Firestore, serverTimestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, User, Auth } from 'firebase/auth';
import { environmentFirebase } from '../../environments/environment.firebase';
import { Difficulty, MapSize } from './settings.service';
import { HARD_CAP } from './tower-defense-engine.service';

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
export interface LevelCompletion {
    lives: number;
    completedAt: any; // Timestamp
}

export interface MasteryProfile {
    totalXp: number;
    usedPoints: number;
    upgrades: { [key: string]: number };
    completedLevels: { [levelId: string]: LevelCompletion };
    totalLivesSum?: number;
    completedLevelsCount?: number;
    lastActivityAt?: any;
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
            const querySize = entry.mapSize;
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

            // Update personal bests collection
            if (entry.userId) {
                const bestId = `${entry.userId}_${querySize}`;
                const bestRef = doc(this.db, 'towerDefenseBestScores', bestId);
                try {
                    const bestSnap = await getDoc(bestRef);
                    if (!bestSnap.exists()) {
                        await setDoc(bestRef, {
                            userId: entry.userId,
                            displayName: entry.displayName,
                            maxWave: entry.maxWave,
                            totalMoney: entry.totalMoney,
                            mapSize: querySize,
                            gridSize: entry.gridSize,
                            userTotalXp,
                            timestamp: serverTimestamp()
                        });
                    } else {
                        const data = bestSnap.data() as TowerDefenseScore;
                        const currentWave = Number(entry.maxWave);
                        const shouldUpdate = typeof data?.maxWave !== 'number' || currentWave > data.maxWave;
                        if (shouldUpdate) {
                            await setDoc(bestRef, {
                                userId: entry.userId,
                                displayName: entry.displayName,
                                maxWave: entry.maxWave,
                                totalMoney: entry.totalMoney,
                                mapSize: querySize,
                                gridSize: entry.gridSize,
                                userTotalXp,
                                timestamp: serverTimestamp()
                            }, { merge: true });
                        } else {
                            // Ensure displayName stays in sync even if not a new max
                            if (data.displayName !== entry.displayName) {
                                await setDoc(bestRef, { displayName: entry.displayName, timestamp: serverTimestamp() }, { merge: true });
                            }
                        }
                    }
                } catch (e) {
                    console.error('Error updating best TD score: ', e);
                }
            }
        } catch (e) {
            console.error('Error adding TD score: ', e);
        }
    }

    async getTopTowerDefenseScores(limitCount: number, size: number): Promise<TowerDefenseScore[]> {
        if (!this.db) return [];
        const querySize = `${size}x${size}`;
        try {
            const q = query(
                collection(this.db, 'towerDefenseBestScores'),
                where('mapSize', '==', querySize),
                orderBy('maxWave', 'desc'),
                limit(limitCount)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(docSnap => docSnap.data() as TowerDefenseScore);

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
            const bestId = `${userId}_${querySize}`;
            const ref = doc(this.db, 'towerDefenseBestScores', bestId);
            const snap = await getDoc(ref);
            if (!snap.exists()) return null;
            return snap.data() as TowerDefenseScore;
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
                    completedLevelIds: Array.isArray(data.completedLevelIds) ? data.completedLevelIds : [],
                    completedLevels: data.completedLevels || {},
                    totalLivesSum: data.totalLivesSum || 0,
                    completedLevelsCount: data.completedLevelsCount || 0
                };
                // Ensure all keys are present or handled in components
                this.masteryProfile.set(profile);
            } else {
                const profile: MasteryProfile = {
                    totalXp: 0,
                    usedPoints: 0,
                    upgrades: {},
                    completedLevelIds: [],
                    completedLevels: {},
                    totalLivesSum: 0,
                    completedLevelsCount: 0
                };
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

    async awardTowerDefenseXp(xp: number, levelId?: string, lives: number = 0): Promise<void> {
        if (!this.db) return;
        const user = this.user$();
        if (!user) return;

        const isWin = lives > 0;

        if (xp > HARD_CAP) {
            console.error(`Security Alert: XP Award Rejected. Attempted: ${xp}, Max Allowed: ${HARD_CAP}`);
            xp = HARD_CAP;
        }

        try {
            const current = this.masteryProfile() ?? {
                totalXp: 0,
                usedPoints: 0,
                upgrades: {},
                completedLevels: {}
            };
            const completedLevelIds = [...(current.completedLevelIds || [])];

            const completedLevels = current.completedLevels || {};
            const previousResult = completedLevels[levelId || ''];

            const isFirstTime = !previousResult;
            const isImproved = previousResult && lives > previousResult.lives;

            if (xp <= 0 && !isFirstTime && !isImproved) {
                return;
            }

            if (levelId && isWin && (isFirstTime || isImproved)) {
                completedLevels[levelId] = {
                    lives: lives,
                    completedAt: new Date()
                };
                if (isFirstTime && !completedLevelIds.includes(levelId)) {
                    completedLevelIds.push(levelId);
                }
            }

            const allLevels = Object.values(completedLevels);
            const totalLivesSum = allLevels.reduce((sum, lvl) => sum + lvl.lives, 0);
            const completedLevelsCount = allLevels.length;

            const next: MasteryProfile = {
                ...current,
                totalXp: current.totalXp + (isFirstTime ? xp : 0),
                completedLevels: completedLevels,
                completedLevelIds: completedLevelIds,
                totalLivesSum,
                completedLevelsCount,
                lastActivityAt: new Date()
            };

            this.masteryProfile.set(next);
            const ref = doc(this.db, 'towerDefenseMasteries', user.uid);
            await setDoc(ref, {
                userId: user.uid,
                displayName: user.displayName,
                ...next
            }, { merge: true });
        } catch (e) {
            console.error('Failed to save TD progress:', e);
        }
    }

    async getCampaignLeaderboard(limitCount: number = 20): Promise<any[]> {

        if (!this.db) {
            console.error('Firestore is not initialized');
            return [];
        }

        try {
            const colRef = collection(this.db, 'towerDefenseMasteries');

            const q = query(
                colRef,
                orderBy('totalLivesSum', 'desc'),
                orderBy('completedLevelsCount', 'desc'),
                limit(limitCount)
            );

            const snap = await getDocs(q);
            return snap.docs.map(d => d.data());
        } catch (e) {
            console.error('Error fetching campaign leaderboard:', e);
            return [];
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

    async getBalanceLogs(gameVersion: string, limitCount = 500): Promise<any[]> {
        if (!this.db) return [];
        try {
            const q = query(
                collection(this.db, 'balance_logs'),
                where('gameVersion', '==', gameVersion),
                orderBy('timestamp', 'desc'),
                limit(limitCount)
            );
            const querySnapshot = await getDocs(q);
            return querySnapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error('Error fetching balance logs: ', e);
            return [];
        }
    }

    async migrateHistoricalScores() {
        // if (!this.db) return;
        // console.log('🚀 Starting optimized migration...');

        // try {
        //     const snapshot = await getDocs(collection(this.db, 'towerDefenseLeaderboards'));
        //     const allRuns = snapshot.docs.map(d => d.data() as TowerDefenseScore);

        //     // Сортуємо: старі спочатку, щоб новіші рекорди перетирали їх
        //     allRuns.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

        //     // Використовуємо локальний Map для збору найкращих результатів перед записом
        //     const bestMap = new Map<string, TowerDefenseScore>();

        //     for (const run of allRuns) {
        //         if (!run.userId || !run.mapSize) continue;
        //         const key = `${run.userId}_${run.mapSize}`;
        //         const existing = bestMap.get(key);

        //         if (!existing || run.maxWave >= existing.maxWave) {
        //             bestMap.set(key, run);
        //         }
        //     }

        //     console.log(`📊 Found ${bestMap.size} unique best scores to migrate.`);

        //     // Записуємо результати
        //     for (const [docId, bestData] of bestMap) {
        //         const bestRef = doc(this.db, 'towerDefenseBestScores', docId);
        //         await setDoc(bestRef, bestData);
        //         console.log(`✅ Migrated: ${docId}`);
        //     }

        //     console.log('🎉 Migration complete!');
        // } catch (error) {
        //     console.error('❌ Migration failed:', error);
        // }
    }
}
