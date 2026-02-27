import { Injectable, signal, computed } from '@angular/core';
import { NgZone } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { Enemy, InfernoZone, Position, Projectile, TDTile, TileType, Tower } from '../models/unit.model';
import { Subject } from 'rxjs';
import { SettingsService } from './settings.service';

import { CampaignService, LevelConfig } from './campaign.service';

// Immutable Constants for Security
const TOWER_COSTS = [15, 50, 250, 500, 500, 500, 500] as const;

const TIER_STATS = [
    { damage: 5, range: 1.5, fireInterval: 0.5 },
    { damage: 14, range: 2.5, fireInterval: 0.45 },
    { damage: 83, range: 1.5, fireInterval: 1 },
    { damage: 350, range: 2.1, fireInterval: 1.7 },
    { damage: 71, range: 1.5, fireInterval: 2.5 },
    { damage: 15, range: 2, fireInterval: 0.3 },
    { damage: 66, range: 1.5, fireInterval: 1 }
] as const;

import { WaveAnalyticsService } from './wave-analytics.service';
import { DamageCalculationService } from './damage-calculation.service';

@Injectable({
    providedIn: 'root'
})
export class TowerDefenseEngineService {
    // Game State
    money = signal(50);
    lives = signal(20);
    wave = signal(0);
    isWaveInProgress = signal(false);
    gameOver = signal(false);

    gridSize = 20;
    grid = signal<TDTile[][]>([]);
    path = signal<Position[]>([]);
    tileSize = 62;

    enemies = signal<Enemy[]>([]);
    projectiles = signal<Projectile[]>([]);
    gameSpeedMultiplier = signal(1);
    nextWaveEnemyType = signal<'tank' | 'scout' | 'standard'>('standard');
    isHardMode = signal(false);
    statsByTowerType = signal<Record<number, number>>({});
    isPaused = signal(false);
    gameMode = signal<'random' | 'campaign'>('random');
    campaignMapId = signal<number>(1);
    campaignDifficulty = signal<'easy' | 'normal' | 'hard'>('normal');

    currentLevelConfig = signal<LevelConfig | null>(null);
    allowedTowers = signal<number[]>([1, 2, 3, 4, 5, 6, 7]);
    public isFirstTimeClear = false;

    private enemiesInternal: Enemy[] = [];
    private projectilesInternal: Projectile[] = [];
    private towersInternal: Tower[] = [];
    private infernoZones: InfernoZone[] = [];
    private enemyIdCounter = 1;
    private projectileIdCounter = 1;

    readonly uiTick$ = new Subject<void>();

    private animationFrameId: number | null = null;
    private lastUpdateTime = 0;
    private enemiesToSpawn = 0;
    private currentWaveEnemyCount = 0;
    private spawnTimer = 0;
    private spawnInterval = 1000;
    private currentWaveType: 'tank' | 'scout' | 'standard' | 'boss' = 'standard';
    private isBossWaveActive = false;

    // Counter Strategy handled by WaveAnalyticsService
    public get activeCounterStrategy() {
        return this.waveAnalytics.activeCounterStrategy;
    }

    // Costs and Stats
    readonly towerCosts = TOWER_COSTS;

    private savedResult = false;
    private gameEndedHard = false;

    private currentScriptedWave: {
        baseType: 'tank' | 'scout' | 'standard';
        isMagma?: boolean;
        isMirror?: boolean;
        isSlime?: boolean;
        isBulwark?: boolean;
    } | null = null;

    private mapScriptedWave(id: number): { baseType: 'tank' | 'scout' | 'standard' } {
        switch (id) {
            case 2: return { baseType: 'scout' };
            case 3: return { baseType: 'tank' };
            case 1: default: return { baseType: 'standard' };
        }
    }

    constructor(
        private ngZone: NgZone,
        private firebase: FirebaseService,
        public settings: SettingsService,
        private campaignService: CampaignService,
        public waveAnalytics: WaveAnalyticsService,
        private damageService: DamageCalculationService
    ) {
        this.initGame();
    }

    private bonusXpAccumulated = 0;

    private async saveResultIfLoggedIn() {
        if (this.savedResult) return;
        this.savedResult = true;
        const user = this.firebase.user$();
        if (!user) return;

        // Centralized XP Calculation
        const xpToAward = this.calculateEarnedXp();
        const config = this.currentLevelConfig();
        const levelId = config?.id;

        if (xpToAward > 0) {
            await this.firebase.awardTowerDefenseXp(xpToAward, levelId, this.wave());
        }

        const mapSizeLabel = this.gridSize === 20 ? '20x20' : '10x10';
        const payload = {
            userId: user.uid,
            displayName: user.displayName || 'Anonymous',
            maxWave: this.wave(),
            totalMoney: this.money(),
            mapSize: mapSizeLabel,
            gridSize: this.gridSize
        };
        try {
            await this.firebase.saveTowerDefenseScore(payload);
        } catch {
        }
    }

    dispose() {
        this.stopGameLoop();
        this.enemiesInternal = [];
        this.projectilesInternal = [];
        this.towersInternal = [];
        this.infernoZones = [];
        this.enemiesToSpawn = 0;
        this.currentWaveEnemyCount = 0;
        this.spawnTimer = 0;
        this.enemies.set([]);
        this.projectiles.set([]);
        this.isWaveInProgress.set(false);
        this.gameOver.set(false);
        this.savedResult = false;
        this.gameEndedHard = false;
        this.money.set(50);
        this.damageTracking.clear(); // Reset Analytics
        this.bonusXpAccumulated = 0;
        this.waveAnalytics.reset();
        this.lives.set(100);
        this.wave.set(0);
        const currentGrid = this.grid();
        if (currentGrid && currentGrid.length) {
            const cleared = currentGrid.map(row =>
                row.map(tile => tile.tower ? { ...tile, tower: null } : tile)
            );
            this.grid.set(cleared);
        }
    }

    resetEngine() {
        this.initializeGame(1);
    }

    initGame() {
        this.initializeGame(1);
    }

    resetGame() {
        this.initializeGame(1);
    }

    generateMap(config?: LevelConfig) {
        let newPath: Position[];

        if (config && config.customPath) {
            newPath = config.customPath;
        } else if (config && config.mapLayout === 'static') {
            newPath = this.getCampaignPath(this.gridSize, 1);
        } else {
            newPath = this.generateRandomPath();
        }

        this.path.set(newPath);

        const newGrid: TDTile[][] = [];
        this.towersInternal = [];
        const pathSet = new Set(newPath.map(p => `${p.x},${p.y}`));

        for (let y = 0; y < this.gridSize; y++) {
            const row: TDTile[] = [];
            for (let x = 0; x < this.gridSize; x++) {
                let type: TileType = 'void';
                let bonus: 'none' | 'damage' | 'range' | 'bounty' | 'mastery' | 'speed' | undefined = undefined;

                if (pathSet.has(`${x},${y}`)) {
                    type = 'path';
                } else {
                    // Check if adjacent to path (Standard Buildable Rule)
                    const neighbors = [
                        { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }
                    ];
                    if (neighbors.some(n => pathSet.has(`${n.x},${n.y}`))) {
                        type = 'buildable';
                    }

                    // Apply Bonus Tiles & Force Buildable (Strategic Points)
                    if (config && config.bonusTiles) {
                        const found = config.bonusTiles.find(t => t.x === x && t.y === y);
                        if (found) {
                            bonus = found.type;
                            type = 'buildable'; // FORCE BUILDABLE for bonus tiles
                        }
                    }
                }

                row.push({ x, y, type, tower: null, bonus });
            }
            newGrid.push(row);
        }
        this.grid.set(newGrid);
    }
    public calculateEarnedXp(): number {
        if (this.gameMode() === 'campaign') {
            const config = this.currentLevelConfig();
            return (config && this.wave() >= config.waveCount && this.isFirstTimeClear) ? config.xpReward : 0;
        }

        const waves = this.wave();
        if (waves < 5) return 0;

        let totalXp = waves * 0.5;

        if (waves > 20) totalXp += (waves - 20) * 2;
        if (waves > 40) totalXp += (waves - 40) * 5;

        const cappedBonusXp = Math.min(this.bonusXpAccumulated, waves * 3);
        totalXp += cappedBonusXp;

        return Math.floor(Math.min(totalXp, 300));
    }
    initializeGame(level: number, campaignLevelId?: string) {
        // Reset state
        this.dispose();
        this.isFirstTimeClear = false;

        // Handle Campaign Mode Configuration
        if (campaignLevelId) {
            const config = this.campaignService.getLevel(campaignLevelId);
            if (config) {
                const profile = this.firebase.masteryProfile();
                const alreadyDone = profile?.completedLevelIds?.includes(campaignLevelId) ?? false;
                this.isFirstTimeClear = !alreadyDone;

                // Use custom grid size if provided, otherwise default to level param (usually 1/10 or 2/20)
                this.gridSize = config.gridSize ?? (level === 2 ? 20 : 10);
                this.updateTileSize();

                this.currentLevelConfig.set(config);
                this.gameMode.set('campaign');
                this.allowedTowers.set(config.allowedTowers);
                this.campaignDifficulty.set(config.difficulty);

                // Set Money from config
                let money = config.startingGold;
                // Add Mastery Bonus
                const goldLevel = this.getGoldMasteryLevel();
                if (goldLevel >= 8) {
                    const bonus = (goldLevel - 7) * 20;
                    money += bonus;
                }
                this.money.set(money);

                this.generateMap(config);
            } else {
                console.error('Level config not found for', campaignLevelId);
                // Fallback to random
                this.gridSize = level === 2 ? 20 : 10;
                this.updateTileSize();
                this.setupRandomGame();
            }
        } else {
            this.gridSize = level === 2 ? 20 : 10;
            this.updateTileSize();
            this.setupRandomGame();
        }

        this.statsByTowerType.set({});
        this.nextWaveEnemyType.set(this.determineWaveType(1));
    }

    private updateTileSize() {
        // zoom works fine
        // this.tileSize = Math.floor(620 / this.gridSize);
    }

    private setupRandomGame() {
        this.currentLevelConfig.set(null);
        this.gameMode.set('random');
        this.allowedTowers.set([1, 2, 3, 4, 5, 6, 7]);
        this.isFirstTimeClear = false;

        let startMoney = 50;
        if (this.isHardMode()) {
            startMoney = 40;
        }
        const goldLevel = this.getGoldMasteryLevel();
        if (goldLevel >= 8) {
            const bonus = (goldLevel - 7) * 20;
            startMoney += bonus;
        }
        this.money.set(startMoney);
        const bonusTiles: { x: number, y: number, type: 'damage' | 'range' | 'bounty' | 'mastery' | 'speed' }[] = [];
        const tempPath = this.generateRandomPath();
        const randomBonusCount = Math.floor(Math.random() * 3) + 3;
        this.path.set(tempPath);

        // Find valid spots for bonus tiles (strategic placement)
        const pathSet = new Set(tempPath.map(p => `${p.x},${p.y}`));
        const validSpots: { x: number, y: number, score: number }[] = [];

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                if (pathSet.has(`${x},${y}`)) continue;

                // 1. Distance Constraint: Must be within 2 cells of path (Chebyshev distance)
                let minDistance = Infinity;
                for (const p of tempPath) {
                    const dist = Math.max(Math.abs(x - p.x), Math.abs(y - p.y));
                    if (dist < minDistance) minDistance = dist;
                    if (minDistance <= 1) break; // Optimization
                }

                if (minDistance > 2) continue; // Skip "dead zones"

                // 2. Strategic Score: Priority to inner corners (surrounded by path)
                let score = 0;
                // Check immediate neighbors (Chebyshev distance 1) for path presence
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        if (pathSet.has(`${x + dx},${y + dy}`)) {
                            score++;
                        }
                    }
                }

                // Add randomness to score to shuffle equal spots
                score += Math.random();

                validSpots.push({ x, y, score });
            }
        }

        const shuffledSpots = validSpots.sort(() => Math.random() - 0.5);
        for (let i = 0; i < randomBonusCount && shuffledSpots.length > 0; i++) {
            const index = Math.floor(Math.pow(Math.random(), 1.5) * shuffledSpots.length);
            const spot = shuffledSpots.splice(index, 1)[0];
            const types = ['damage', 'range', 'speed', 'bounty', 'mastery'] as const;
            const type = types[Math.floor(Math.random() * types.length)];
            bonusTiles.push({ x: spot.x, y: spot.y, type });
        }

        // Call generateMap with our random configuration
        this.generateMap({
            id: 'random',
            name: 'Random Sector',
            description: 'Procedurally generated zone.',
            waveCount: 999,
            startingGold: startMoney,
            allowedTowers: [1, 2, 3, 4, 5, 6, 7],
            mapLayout: 'random',
            difficulty: this.isHardMode() ? 'hard' : 'normal',
            xpReward: 0,
            customPath: tempPath,
            bonusTiles: bonusTiles
        });
    }

    private determineWaveType(wave: number): 'tank' | 'scout' | 'standard' {
        if (wave <= 2) { return 'standard'; }
        const roll = Math.random();
        if (roll < 0.20) return 'tank';
        if (roll < 0.41) return 'scout';
        return 'standard';
    }

    private getGoldMasteryLevel(): number {
        if (!this.areMasteriesActiveForWave(this.wave())) return 0;
        const profile = this.firebase.masteryProfile();
        const v = profile && profile.upgrades ? profile.upgrades['gold_mastery'] : 0;
        return typeof v === 'number' ? v : 0;
    }

    private getGoldKillMultiplier(): number {
        const level = this.getGoldMasteryLevel();
        if (level <= 0) return 1;
        const stage1 = Math.min(level, 7);
        const stage2 = Math.max(0, Math.min(level - 7, 7));
        const stage3 = Math.max(0, level - 14);
        const bonus = stage1 * 0.05 + stage2 * 0.1 + stage3 * 0.15;
        return 1 + bonus;
    }

    private generateRandomPath(): Position[] {
        const size = this.gridSize;
        const total = size * size;
        const minLen = Math.floor(total * 0.35);
        const maxLen = Math.floor(total * 0.4);
        const safetyLimit = 1000;

        const encode = (p: Position) => `${p.x},${p.y}`;
        const inBounds = (x: number, y: number) =>
            x >= 0 && y >= 0 && x < size && y < size;

        const randInt = (a: number, b: number) =>
            a + Math.floor(Math.random() * (b - a + 1));

        const startY = randInt(0, size - 1);
        const endY = randInt(0, size - 1);
        const start: Position = { x: 0, y: startY };
        const end: Position = { x: size - 1, y: endY };

        const buildStraight = (): Position[] => {
            const result: Position[] = [];
            let x = start.x;
            let y = start.y;
            result.push({ x, y });
            const stepX = end.x > x ? 1 : -1;
            for (let i = 0; i < safetyLimit && x !== end.x; i++) {
                x += stepX;
                result.push({ x, y });
            }
            const stepY = end.y > y ? 1 : -1;
            for (let i = 0; i < safetyLimit && y !== end.y; i++) {
                y += stepY;
                result.push({ x, y });
            }
            return result;
        };

        const visited = new Set<string>();
        const path: Position[] = [];

        let iterations = 0;

        const canStep = (nx: number, ny: number, prev: Position): boolean => {
            if (!inBounds(nx, ny)) return false;
            const key = encode({ x: nx, y: ny });
            if (visited.has(key)) return false;
            const neighbors: Position[] = [
                { x: nx + 1, y: ny },
                { x: nx - 1, y: ny },
                { x: nx, y: ny + 1 },
                { x: nx, y: ny - 1 }
            ];
            for (const n of neighbors) {
                if (!inBounds(n.x, n.y)) continue;
                const k = encode(n);
                if (!visited.has(k)) continue;
                if (n.x === prev.x && n.y === prev.y) continue;
                return false;
            }
            return true;
        };

        let current: Position = { ...start };
        path.push(current);
        visited.add(encode(current));

        const midX1 = Math.floor(size / 3);
        const midX2 = Math.floor((2 * size) / 3);
        const midY = Math.floor(size / 2);

        const mid1: Position = { x: midX1, y: randInt(0, Math.max(0, midY - 1)) };
        const mid2: Position = { x: midX2, y: randInt(midY, size - 1) };

        const targets: Position[] = [mid1, mid2, end];

        const connectTo = (target: Position) => {
            for (let i = 0; i < safetyLimit && current.x !== target.x; i++) {
                iterations++;
                if (iterations > safetyLimit) return;
                if (path.length >= maxLen) return;
                const dirX = target.x > current.x ? 1 : -1;
                const nx = current.x + dirX;
                const ny = current.y;
                if (!canStep(nx, ny, current)) break;
                const next: Position = { x: nx, y: ny };
                path.push(next);
                visited.add(encode(next));
                current = next;
            }
            for (let i = 0; i < safetyLimit && current.y !== target.y; i++) {
                iterations++;
                if (iterations > safetyLimit) return;
                if (path.length >= maxLen) return;
                const dirY = target.y > current.y ? 1 : -1;
                const nx = current.x;
                const ny = current.y + dirY;
                if (!canStep(nx, ny, current)) break;
                const next: Position = { x: nx, y: ny };
                path.push(next);
                visited.add(encode(next));
                current = next;
            }
        };

        for (let i = 0; i < targets.length; i++) {
            iterations++;
            if (iterations > safetyLimit) {
                return buildStraight();
            }
            connectTo(targets[i]);
        }

        if (path.length < minLen) {
            for (let i = 0; i < safetyLimit && path.length < minLen; i++) {
                iterations++;
                if (iterations > safetyLimit) {
                    return buildStraight();
                }
                const dirs: Position[] = [
                    { x: 1, y: 0 },
                    { x: -1, y: 0 },
                    { x: 0, y: 1 },
                    { x: 0, y: -1 }
                ];
                let extended = false;
                for (let d = 0; d < dirs.length; d++) {
                    const dir = dirs[d];
                    const nx = current.x + dir.x;
                    const ny = current.y + dir.y;
                    if (!canStep(nx, ny, current)) continue;
                    const next: Position = { x: nx, y: ny };
                    path.push(next);
                    visited.add(encode(next));
                    current = next;
                    extended = true;
                    break;
                }
                if (!extended) break;
            }
        }

        if (path.length === 0) {
            return buildStraight();
        }

        return path;
    }

    private getCampaignPath(size: number, mapId: number): Position[] {
        const path: Position[] = [];
        const midY = Math.floor(size / 2);
        if (mapId === 1) {
            for (let x = 0; x < size; x++) path.push({ x, y: midY });
        } else if (mapId === 2) {
            let y = 0;
            for (let x = 0; x < size; x++) {
                path.push({ x, y });
                if (x % 2 === 1 && y < size - 1) y++;
            }
        } else {
            const midX = Math.floor(size / 2);
            for (let y = 0; y < size; y++) path.push({ x: midX, y });
        }
        return path;
    }

    setModeRandom() {
        if (this.isWaveInProgress()) return;
        this.gameMode.set('random');
        this.initializeGame(this.gridSize === 20 ? 2 : 1);
    }
    startWave() {
        if (this.isWaveInProgress() || this.gameOver()) return;

        // Extra check: If we just finished the last wave of a campaign, don't start a new one
        // unless it's Random mode (infinite)
        const config = this.currentLevelConfig();
        if (config && this.wave() >= config.waveCount) {
            console.warn("Attempted to start wave beyond limit. Victory should have triggered.");
            return;
        }

        this.wave.update(w => w + 1);
        this.isWaveInProgress.set(true);

        // Analyze Strategy for this wave (Random Mode Only)
        if (this.gameMode() === 'random') {
            this.waveAnalytics.updateRollingAnalytics(this.statsByTowerType());
            this.waveAnalytics.analyzeAndSetStrategy(this.wave());
        }

        // Scripted Logic for CURRENT Wave
        const currentWave = this.wave();

        // Determine if this is a Boss Wave based on distribution
        let isBossWave = false;
        if (config && config.bossCount && config.waveCount) {
            const bosses = config.bossCount;
            const waves = config.waveCount;
            // Rule: Last wave always has boss
            if (currentWave === waves) {
                isBossWave = true;
            } else {
                const interval = waves / bosses;
                for (let i = 1; i <= bosses; i++) {
                    const bossWaveIndex = Math.floor(interval * i);
                    if (currentWave === bossWaveIndex) {
                        isBossWave = true;
                        break;
                    }
                }
            }
        }

        if (config && config.waveTypeSequence && config.waveTypeSequence.length >= currentWave) {
            const typeId = config.waveTypeSequence[currentWave - 1];
            this.currentScriptedWave = this.mapScriptedWave(typeId);
            this.currentWaveType = this.currentScriptedWave.baseType;
        } else {
            this.currentScriptedWave = null;
            this.currentWaveType = this.nextWaveEnemyType();
        }

        // Override for Boss
        if (isBossWave) {
            this.isBossWaveActive = true;
        } else {
            this.isBossWaveActive = false;
        }

        // Scripted Logic for NEXT Wave (for UI prediction)
        if (config && config.waveTypeSequence && config.waveTypeSequence.length >= this.wave() + 1) {
            const nextTypeId = config.waveTypeSequence[this.wave()];
            const nextDef = this.mapScriptedWave(nextTypeId);
            this.nextWaveEnemyType.set(nextDef.baseType);
        } else {
            this.nextWaveEnemyType.set(this.determineWaveType(this.wave() + 1));
        }

        // Cap unit count, increase stats instead
        const wave = this.wave();
        const baseCount = 5 + wave * 2;
        const maxUnits = 50; // Hard cap
        let actualCount = Math.min(baseCount, maxUnits);
        if (config && config.waveModifiers) {
            const wm = config.waveModifiers[wave];
            if (wm && typeof wm.count === 'number') {
                actualCount = Math.min(Math.max(1, Math.floor(wm.count)), maxUnits);
            }
        }
        this.currentWaveEnemyCount = actualCount;
        this.enemiesToSpawn = actualCount;
        this.spawnTimer = 0;

        this.startGameLoop();
    }

    public masteriesActiveForCurrentWave(): boolean {
        return this.areMasteriesActiveForWave(this.wave());
    }

    private areMasteriesActiveForWave(wave?: number): boolean {
        if (this.gameMode() !== 'campaign') return true;
        const cfg = this.currentLevelConfig();
        if (!cfg) return true;
        const globalEnabled = cfg.masteriesEnabled !== false;
        const w = typeof wave === 'number' ? wave : this.wave();
        const override = cfg.waveModifiers?.[w]?.masteryOverride;
        if (typeof override === 'boolean') return override;
        return globalEnabled;
    }

    private startGameLoop() {
        this.stopGameLoop();
        this.lastUpdateTime = performance.now();

        this.ngZone.runOutsideAngular(() => {
            const loop = (currentTime: number) => {
                if (this.gameOver()) return;

                const dt = (currentTime - this.lastUpdateTime) / 1000;
                this.lastUpdateTime = currentTime;
                const cappedDt = Math.min(dt, 0.05);
                this.updateGame(cappedDt);
                this.enemies.set([...this.enemiesInternal]);
                if (this.gameSpeedMultiplier() === 1) {
                    this.projectiles.set([...this.projectilesInternal]);
                } else {
                    this.projectiles.set([]);
                }
                this.uiTick$.next();
                this.animationFrameId = requestAnimationFrame(loop);
            };

            this.animationFrameId = requestAnimationFrame(loop);
        });
    }

    stopGameLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    updateGame(dt: number) {
        if (this.gameEndedHard || this.isPaused()) {
            return;
        }

        const effectiveDt = dt * this.gameSpeedMultiplier();
        this.handleSpawning(effectiveDt);
        this.updateEnemies(effectiveDt);
        this.updateTowers(effectiveDt);
        this.updateProjectiles(effectiveDt);

        // Campaign Victory Check
        // Only trigger victory if enemies are CLEARED and we've completed the FINAL wave
        const config = this.currentLevelConfig();
        if (config && this.wave() >= config.waveCount && this.enemiesInternal.length === 0 && this.enemiesToSpawn === 0) {
            // Victory!
            this.enemiesInternal = [];
            this.projectilesInternal = [];
            this.stopGameLoop();
            this.ngZone.run(() => {
                this.isWaveInProgress.set(false);
                this.gameOver.set(true);
            });
            if (!this.savedResult) {
                this.savedResult = true;
                this.saveResultIfLoggedIn();
            }
            this.gameEndedHard = true;
            return;
        }

        if (this.lives() <= 0 && !this.gameOver()) {
            this.enemiesInternal = [];
            this.projectilesInternal = [];
            this.enemiesToSpawn = 0;
            this.stopGameLoop();
            this.ngZone.run(() => {
                this.enemies.set([]);
                this.projectiles.set([]);
                this.isWaveInProgress.set(false);
                this.gameOver.set(true);
            });
            if (!this.savedResult) {
                this.savedResult = true;
                this.saveResultIfLoggedIn();
                // Logic moved to saveResultIfLoggedIn to centralize XP checks
            }
            this.gameEndedHard = true;
            return;
        }

        if (this.enemiesInternal.length === 0 && this.enemiesToSpawn === 0 && this.isWaveInProgress()) {
            this.enemiesInternal = [];
            this.projectilesInternal = [];
            this.ngZone.run(() => {
                this.enemies.set([]);
                this.projectiles.set([]);
                this.isWaveInProgress.set(false);
            });
            const goldLevel = this.getGoldMasteryLevel();
            if (goldLevel >= 15) {
                const bonus = (goldLevel - 14) * 5;
                this.money.update(m => m + bonus);
            }
        }
    }

    pauseGame() {
        this.isPaused.set(true);
    }

    resumeGame() {
        this.isPaused.set(false);
    }

    private getUpgradeLevel(tier: number, kind: 'damage' | 'range' | 'golden'): number {
        if (!this.areMasteriesActiveForWave(this.wave())) return 0;
        const profile = this.firebase.masteryProfile();
        if (!profile) return 0;
        const key = `t${tier}_${kind}`;
        const v = profile.upgrades?.[key];
        return typeof v === 'number' ? v : 0;
    }

    private getProjectileSpeedMultiplierForTower(tower: Tower): number {
        if (tower.type === 2) {
            const golden = this.getUpgradeLevel(2, 'golden');
            if (golden > 0) return 1 + 0.2 * golden;
        }
        return 1;
    }

    private triggerInfernoChainReaction(pos: Position, maxHp: number) {
        const golden = this.getUpgradeLevel(5, 'golden');
        if (golden <= 0) return;
        const damage = Math.floor(maxHp * 0.5);
        const radius = 2;
        const radiusSq = radius * radius;
        for (const enemy of this.enemiesInternal) {
            const dx = pos.x - enemy.position.x;
            const dy = pos.y - enemy.position.y;
            if (dx * dx + dy * dy <= radiusSq) {
                this.damageService.applyDamage(enemy, damage, 5, this.wave(), undefined, (id, amt) => this.recordDamage(id, amt, 5));
            }
        }
        const explosion = this.damageService.createInfernoZone(pos, 'z' + (this.projectileIdCounter++), radius);
        this.infernoZones.push(explosion);
    }

    // Track total damage for analytics (MVP)
    private damageTracking: Map<string, number> = new Map();

    private handleSpawning(dt: number) {
        if (this.enemiesToSpawn <= 0) return;

        this.spawnTimer += dt * 1000;
        if (this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy();
            this.enemiesToSpawn--;
        }
    }

    private spawnEnemy() {
        const currentWave = this.wave();

        // HP Scaling
        let hpMultiplier: number;
        if (currentWave <= 10) {
            // Linear: 1.2, 1.4... 3.0
            hpMultiplier = 1 + 0.2 * currentWave;
        } else {
            const w = currentWave - 10;
            hpMultiplier = 3.0 * Math.pow(1.15, w);
        }

        const hp = 50 * hpMultiplier;

        // Apply Level Specific Multiplier
        let levelMultiplier = 1;
        if (this.gameMode() === 'campaign') {
            const config = this.currentLevelConfig();
            if (config && config.healthMultiplier) {
                levelMultiplier = config.healthMultiplier;
            }
        }

        const baseSpeed = 0.5 + (currentWave * 0.02) + (Math.floor(currentWave / 5) * 0.1);
        const total = this.currentWaveEnemyCount || (5 + this.wave() * 2);
        const spawnedSoFar = total - this.enemiesToSpawn;

        // Smart Boss Logic or Legacy Boss Logic
        let boss = false;
        if (this.isBossWaveActive) {
            // In Campaign, only spawn ONE boss per boss wave, usually at the end
            const isLastOfWave = spawnedSoFar === total - 1;
            if (isLastOfWave) {
                boss = true;
            }
        } else {
            if (this.gameMode() === 'random') {
                const isBossWave = this.wave() % 5 === 0;
                const isLastOfWave = spawnedSoFar === total - 1;
                boss = isBossWave && isLastOfWave;
            }
        }

        const hue = (this.wave() * 40) % 360;

        let enemyType: 'tank' | 'scout' | 'standard' | 'boss' = this.currentWaveType;
        // Force Boss type if boss flag is true
        if (boss) {
            enemyType = 'boss';
        }

        let hpFinal = hp * levelMultiplier;
        let speedFinal = baseSpeed;
        if (enemyType === 'tank') {
            hpFinal = hp * levelMultiplier * 2;
            speedFinal = baseSpeed * 0.5;
        } else if (enemyType === 'scout') {
            hpFinal = hp * levelMultiplier * 0.4;
            speedFinal = baseSpeed * 2.0;
        } else if (enemyType === 'boss') {
            // Boss HP Calculation
            hpFinal = hp * levelMultiplier * 6;
            speedFinal = baseSpeed * 0.5;
        }
        if (this.isHardMode()) {
            hpFinal *= 1.5;
            speedFinal *= 1.1;
        }

        const newEnemy: Enemy = {
            id: 'e' + (this.enemyIdCounter++),
            position: { ...this.path()[0] },
            pathIndex: 0,
            hp: hpFinal,
            maxHp: hpFinal,
            speed: speedFinal,
            progress: 0,
            isBoss: boss,
            hue,
            baseSpeed,
            speedModifier: 1,
            shatterStacks: 0,
            isFrozen: false,
            type: enemyType
        };

        // Counter Strategy Logic (Random Mode Only)
        // Uses pre-calculated strategy for the wave
        if (this.gameMode() === 'random' && this.waveAnalytics.currentWaveCounterType && !boss) {
            const spawnChance = this.waveAnalytics.currentWaveCounterChance;
            const counterType = this.waveAnalytics.currentWaveCounterType;

            if (Math.random() < spawnChance) {
                const flags = this.waveAnalytics.getCounterFlag(counterType);
                Object.assign(newEnemy, flags);

                // Earlier HP Buff for Resistant Enemies
                let hpBonus = 1.0;
                if (this.wave() >= 29) {
                    hpBonus = 1.5;
                } else if (this.wave() >= 19) {
                    hpBonus = 1.3;
                }

                if (hpBonus > 1.0) {
                    newEnemy.maxHp = Math.floor(newEnemy.maxHp * hpBonus);
                    newEnemy.hp = newEnemy.maxHp;
                }

                console.log(`[WAVE ${this.wave()}] Spawning enemy with resistance against Type ${counterType}`);
            }
        }

        if (this.currentScriptedWave) {
            if (this.currentScriptedWave.isMagma) newEnemy.isMagma = true;
            if (this.currentScriptedWave.isMirror) newEnemy.isMirror = true;
            if (this.currentScriptedWave.isSlime) newEnemy.isSlime = true;
            if (this.currentScriptedWave.isBulwark) newEnemy.isBulwark = true;
        }

        // Apply Wave Modifiers from LevelConfig
        const config = this.currentLevelConfig();
        if (config && config.waveModifiers) {
            const waveMod = config.waveModifiers[this.wave()];
            const traits = waveMod?.traits;
            if (traits && traits.length) {
                for (const mod of traits) {
                    if (Math.random() < mod.chance) {
                        (newEnemy as any)[mod.property] = true;
                    }
                }
            }
        }

        this.enemiesInternal.push(newEnemy);
    }

    private updateEnemies(dt: number) {
        for (let i = this.enemiesInternal.length - 1; i >= 0; i--) {
            const enemy = this.enemiesInternal[i];
            enemy.speedModifier = 1;
            enemy.isFrozen = false;
            enemy.burnedByInferno = false;
            if (enemy.stunTime && enemy.stunTime > 0) {
                enemy.stunTime = Math.max(0, enemy.stunTime - dt);
            }
            if (enemy.prismVulnerableTime && enemy.prismVulnerableTime > 0) {
                enemy.prismVulnerableTime = Math.max(0, enemy.prismVulnerableTime - dt);
            }

            const venomDamage = this.damageService.processVenomTick(enemy, dt);
            if (venomDamage > 0) {
                this.damageService.applyDamage(enemy, venomDamage, 7, this.wave());
            }
        }

        for (let i = this.infernoZones.length - 1; i >= 0; i--) {
            const zone = this.infernoZones[i];
            zone.remaining -= dt;
            if (zone.remaining <= 0) {
                this.infernoZones.splice(i, 1);
            }
        }

        this.applyFrostAuras();

        const tile = this.tileSize;

        for (const zone of this.infernoZones) {
            const radiusSq = zone.radius * zone.radius;
            for (const enemy of this.enemiesInternal) {
                const dx = zone.position.x - enemy.position.x;
                const dy = zone.position.y - enemy.position.y;
                if (dx * dx + dy * dy <= radiusSq) {
                    if (zone.dps > 0) {
                        this.damageService.applyDamage(enemy, zone.dps * dt, 5, this.wave());
                        enemy.burnedByInferno = true;
                    }
                }
            }
        }

        for (let i = this.enemiesInternal.length - 1; i >= 0; i--) {
            const enemy = this.enemiesInternal[i];
            const isStunned = !!(enemy.stunTime && enemy.stunTime > 0);

            // Set base player damage based on type if not set
            if (enemy.basePlayerDamage === undefined) {
                enemy.basePlayerDamage = enemy.type === 'boss' ? 10 : 3;
            }

            if (!isStunned) {
                const base = enemy.baseSpeed;
                const archetypeMultiplier =
                    enemy.type === 'tank' ? 0.5 :
                        enemy.type === 'scout' ? 2.0 :
                            enemy.type === 'boss' ? 0.5 : 1;
                const moveSpeed = base * archetypeMultiplier * enemy.speedModifier;
                enemy.progress += moveSpeed * dt;

                if (enemy.progress >= 1) {
                    enemy.pathIndex++;
                    enemy.progress = 0;

                    if (enemy.pathIndex >= this.path().length - 1) {
                        // Dynamic Damage Calculation
                        // Base: Boss = 10, Standard = 3
                        // Boss Rules: >90% HP -> 10, 50-90% -> 8, 10-50% -> 4, <10% -> 1
                        // Standard Rules: >90% HP -> 3, 50-90% -> 2, <50% -> 1

                        let damageToLives = 1;
                        const hpPercent = enemy.hp / enemy.maxHp;

                        if (enemy.type === 'boss') {
                            const baseDmg = 10;
                            if (hpPercent > 0.9) damageToLives = 10;
                            else if (hpPercent > 0.5) damageToLives = 8;
                            else if (hpPercent > 0.1) damageToLives = 4;
                            else damageToLives = 1;
                        } else {
                            // Standard, Tank, Scout
                            const baseDmg = 3;
                            if (hpPercent > 0.9) damageToLives = 3;
                            else if (hpPercent > 0.5) damageToLives = 2;
                            else damageToLives = 1;
                        }

                        this.enemiesInternal.splice(i, 1);
                        this.ngZone.run(() => this.lives.update(l => Math.max(0, l - damageToLives)));

                        // Check for Game Over
                        if (this.lives() <= 0) {
                            this.endGame(false);
                        }

                        if (this.enemiesInternal.length === 0 && this.enemiesToSpawn === 0) {
                            this.currentWaveType = 'standard';
                        }
                        continue;
                    }
                    enemy.position = { ...this.path()[enemy.pathIndex] };
                }
            }

            const path = this.path();
            const current = path[enemy.pathIndex];
            const next = path[enemy.pathIndex + 1] || current;
            const ix = current.x + (next.x - current.x) * enemy.progress;
            const iy = current.y + (next.y - current.y) * enemy.progress;
            enemy.displayX = (ix + 0.5) * tile;
            enemy.displayY = (iy + 0.5) * tile;
            const baseLight = 60;
            const lightness = baseLight;
            let scale = 1;
            if (enemy.type === 'tank') scale = 1.2;
            else if (enemy.type === 'scout') scale = 0.9;
            else if (enemy.type === 'boss') scale = 1.6;
            enemy.scale = scale;
            if (enemy.isFrozen) {
                enemy.bg = `hsl(190, 80%, ${lightness}%)`;
            } else if (enemy.type === 'tank') {
                enemy.bg = `hsl(330, 70%, 60%)`;
            } else if (enemy.type === 'scout') {
                enemy.bg = `hsl(50, 90%, 60%)`;
            } else if (enemy.type === 'boss') {
                enemy.bg = `hsl(${enemy.hue}, 90%, 65%)`;
            } else {
                enemy.bg = `hsl(200, 70%, 60%)`;
            }

            if (enemy.hp <= 0) {
                const diedBurning = !!enemy.burnedByInferno;
                const deathPos = { ...enemy.position };
                const deathMaxHp = enemy.maxHp;
                this.enemiesInternal.splice(i, 1);
                if (diedBurning) {
                    this.triggerInfernoChainReaction(deathPos, deathMaxHp);
                }
                // Diminishing Gold Returns (Bounty Decay)
                // Base: 5 + wave. Decay: 1% less per wave after 10
                const wave = this.wave();
                let baseReward = 5 + wave;

                if (wave > 10) {
                    const decayFactor = Math.max(0.2, 1 - (wave - 10) * 0.01);
                    baseReward = Math.floor(baseReward * decayFactor);
                }

                const goldMultiplier = this.getGoldKillMultiplier();
                let reward = Math.floor(baseReward * goldMultiplier);

                // Boss Reward Bonus (5x)
                if (enemy.type === 'boss') {
                    reward *= 5;
                    this.bonusXpAccumulated += 50;
                }


                const bountyTowers = this.towersInternal.filter(t => {
                    const tile = this.grid()[t.position.y][t.position.x];
                    return tile.bonus === 'bounty';
                });

                for (const bt of bountyTowers) {
                    const dx = bt.position.x - deathPos.x;
                    const dy = bt.position.y - deathPos.y;
                    if (dx * dx + dy * dy <= bt.range * bt.range) {
                        reward += 2; // +2 Gold per kill near Bounty Tower
                        break; // Only once
                    }
                }

                if (this.isHardMode()) {
                    reward = Math.floor(reward * 0.8);
                }
                {
                    const cfg = this.currentLevelConfig();
                    const bountyMultiplier = cfg?.bountyMultiplier ?? 1.0;
                    reward = Math.floor(reward * bountyMultiplier);
                }
                this.ngZone.run(() => this.money.update(m => m + reward));
            }
        }
    }

    private updateTowers(dt: number) {
        if (this.enemiesInternal.length === 0 || this.towersInternal.length === 0) return;
        for (const tower of this.towersInternal) {
            tower.cooldown -= dt;
            if (tower.cooldown <= 0) {
                const target = this.findTargetForTower(tower, this.enemiesInternal);
                if (target) {
                    tower.targetEnemyId = target.id;
                    this.fireAt(tower, target);
                    if (tower.type === 7) {
                        tower.hitsOnTarget = (tower.hitsOnTarget || 0) + 1;
                    }
                    tower.cooldown = tower.fireInterval;
                } else {
                    tower.targetEnemyId = undefined;
                    tower.beamTime = 0;
                    tower.lastBeamTargetId = undefined;
                    tower.extraTargetIds = undefined;
                    tower.cooldown = 0;
                    if (tower.type === 7) {
                        tower.hitsOnTarget = 0;
                    }
                }
            }
        }
    }


    private applyFrostAuras() {
        this.damageService.applyFrostAuras(
            this.enemiesInternal,
            this.towersInternal.filter(t => t.type === 1 && t.specialActive),
            (tier, type: 'damage' | 'range' | 'golden') => this.getUpgradeLevel(tier, type)
        );
    }

    private findTargetForTower(tower: Tower, enemies: Enemy[]): Enemy | null {
        const stickyTypes = [3, 6];

        if (tower.targetEnemyId) {
            const currentTarget = enemies.find(e => e.id === tower.targetEnemyId);

            if (currentTarget && currentTarget.hp > 0) {
                const dx = tower.position.x - currentTarget.position.x;
                const dy = tower.position.y - currentTarget.position.y;
                const distSq = dx * dx + dy * dy;
                const effRange = tower.type === 1 ? this.getEffectiveRange(tower) : tower.range;
                const rangeSq = effRange * effRange;

                if (distSq <= rangeSq) {
                    if (tower.type === 7) {
                        if ((tower.hitsOnTarget ?? 0) < 3) {
                            return currentTarget;
                        }
                    } else if (stickyTypes.includes(tower.type)) {
                        return currentTarget;
                    }
                }
            }
        }

        const effRange = tower.type === 1 ? this.getEffectiveRange(tower) : tower.range;
        const rangeSq = effRange * effRange;
        const candidates: { enemy: Enemy; distSq: number; progressScore: number }[] = [];

        for (const enemy of enemies) {
            const dx = tower.position.x - enemy.position.x;
            const dy = tower.position.y - enemy.position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq > rangeSq) continue;

            if (tower.type === 7 && enemy.id === tower.targetEnemyId && (tower.hitsOnTarget ?? 0) >= 3) {
                continue;
            }

            const idx = enemy.pathIndex ?? 0;
            const prog = enemy.progress ?? 0;
            const progressScore = idx + prog;
            candidates.push({ enemy, distSq, progressScore });
        }

        if (candidates.length === 0) {
            tower.hitsOnTarget = 0;
            return null;
        }

        const selectedEnemy = this.applyStrategy(tower, candidates);

        if (tower.targetEnemyId !== selectedEnemy.id) {
            tower.hitsOnTarget = 0;
        }

        return selectedEnemy;
    }

    getEffectiveRange(tower: Tower): number {
        if (tower.type === 1) {
            const golden = this.getUpgradeLevel(1, 'golden');
            return tower.range * (1 + golden * 0.1);
        }
        return tower.range;
    }

    private applyStrategy(tower: Tower, candidates: any[]): Enemy {
        const strat = tower.strategy || 'first';

        if (strat === 'random') return candidates[Math.floor(Math.random() * candidates.length)].enemy;

        if (strat === 'weakest') {
            return candidates.reduce((prev, curr) => curr.enemy.hp < prev.enemy.hp ? curr : prev).enemy;
        }
        if (strat === 'strongest') {
            return candidates.reduce((prev, curr) => curr.enemy.hp > prev.enemy.hp ? curr : prev).enemy;
        }

        return candidates.reduce((prev, curr) => curr.progressScore > prev.progressScore ? curr : prev).enemy;
    }

    private pushProjectile(p: Projectile) {
        if (this.projectilesInternal.length >= 100) {
            this.projectilesInternal.shift();
        }
        this.projectilesInternal.push(p);
    }

    private recordDamage(sourceTowerId: string | undefined, amount: number, type?: number) {
        if (sourceTowerId) {
            const current = this.damageTracking.get(sourceTowerId) || 0;
            this.damageTracking.set(sourceTowerId, current + amount);
        }

        let typeToUpdate = type;
        if (!typeToUpdate && sourceTowerId) {
            const t = this.towersInternal.find(t => t.id === sourceTowerId);
            if (t) typeToUpdate = t.type;
        }

        if (typeToUpdate) {
            const t = typeToUpdate;
            this.statsByTowerType.update(stats => ({
                ...stats,
                [t]: (stats[t] || 0) + amount
            }));
        }
    }

    // Renamed to internalFireAt to avoid conflict if any, or just update logic
    private fireAt(tower: Tower, enemy: Enemy) {
        if (tower.type !== 6) {
            const proj: Projectile = {
                id: 'p' + (this.projectileIdCounter++),
                from: { ...tower.position },
                to: { ...enemy.position },
                progress: 0,
                speedMultiplier: this.getProjectileSpeedMultiplierForTower(tower)
            };
            this.pushProjectile(proj);
        }

        const damage = this.damageService.calculateTowerDamage(
            tower,
            enemy,
            (tier, type: 'damage' | 'range' | 'golden') => this.getUpgradeLevel(tier, type)
        );

        if (tower.type === 5) {
            const radius = tower.specialActive ? 2.5 : 1.5;
            const radiusSq = radius * radius;
            const basePos = enemy.position;
            for (const other of this.enemiesInternal) {
                const dx = basePos.x - other.position.x;
                const dy = basePos.y - other.position.y;
                if (dx * dx + dy * dy <= radiusSq) {
                    let aoeDamage = damage;
                    if (other.prismVulnerableTime && other.prismVulnerableTime > 0) {
                        aoeDamage = Math.floor(aoeDamage * 1.15);
                    }
                    this.damageService.applyDamage(other, aoeDamage, 5, this.wave(), tower.id, this.recordDamage.bind(this));
                    other.burnedByInferno = true;
                }
            }
            if (tower.specialActive) {
                const zone = this.damageService.createInfernoZone(basePos, 'z' + (this.projectileIdCounter++), radius);
                this.infernoZones.push(zone);
            }
        } else if (tower.type === 7) {
            this.damageService.applyVenomStack(enemy, damage, tower.specialActive);
            this.damageService.applyDamage(enemy, damage, tower.type, this.wave(), tower.id, this.recordDamage.bind(this));
        } else if (tower.type !== 6 || !tower.specialActive) {
            this.damageService.applyDamage(enemy, damage, tower.type, this.wave(), tower.id, this.recordDamage.bind(this));
        }

        if (tower.type === 3) {
            const golden = this.getUpgradeLevel(3, 'golden');
            if (golden > 0) {
                // Golden Mastery - "Concussive Blasts"
                // Logic: If enemy has shatter stacks, boost stun chance and duration
                const shatterStacks = enemy.shatterStacks || 0;

                let stunChance = 0.15 + golden * 0.05;
                let durationBonus = 0;

                if (shatterStacks > 0) {
                    stunChance += 0.15; // +15% Chance
                    durationBonus = shatterStacks * 0.5; // +0.5s per stack
                }

                if (Math.random() < stunChance) {
                    const baseDuration = ((0.5 + golden * 0.2) * 1.2) + durationBonus;
                    enemy.stunTime = Math.max(enemy.stunTime ?? 0, baseDuration);
                }
            }
        }

        if (tower.type === 2 && tower.specialActive) {
            const golden = this.getUpgradeLevel(2, 'golden');
            const maxChainTargets = 2 + golden;
            // Lightning jump radius (3 cells is distSq 9)
            const jumpRangeSq = 9;
            let chainCount = 0;
            const hitEnemies = new Set([enemy.id]);

            for (const potentialTarget of this.enemiesInternal) {
                if (chainCount >= maxChainTargets) break;
                if (hitEnemies.has(potentialTarget.id) || potentialTarget.hp <= 0) continue;

                const dx = enemy.position.x - potentialTarget.position.x;
                const dy = enemy.position.y - potentialTarget.position.y;
                const distSq = dx * dx + dy * dy;

                if (distSq <= jumpRangeSq) {
                    hitEnemies.add(potentialTarget.id);
                    chainCount++;

                    this.pushProjectile({
                        id: 'p' + (this.projectileIdCounter++),
                        from: { ...enemy.position },
                        to: { ...potentialTarget.position },
                        progress: 0,
                        speedMultiplier: 2
                    });

                    const chainDmgMultiplier = 0.7 + (golden * 0.1);
                    const chainDamage = Math.floor(tower.damage * chainDmgMultiplier);
                    this.damageService.applyDamage(potentialTarget, chainDamage, tower.type, this.wave(), tower.id, this.recordDamage.bind(this));
                }
            }
        }

        if (tower.specialActive && tower.type === 6) {
            const golden = this.getUpgradeLevel(6, 'golden');
            const sameTarget = tower.lastBeamTargetId === enemy.id;
            const maxBonus = golden > 0 ? 3 : 1;
            const ramp = 1 + Math.min(maxBonus, (tower.beamTime ?? 0) * 0.5);
            // damage already has ramp applied!
            const mainDamage = damage;
            const targets: Enemy[] = [enemy];
            if (sameTarget) {
                const rangeSq = tower.range * tower.range;
                const candidates: { enemy: Enemy; distSq: number }[] = [];
                for (const other of this.enemiesInternal) {
                    if (other.id === enemy.id || other.hp <= 0) continue;
                    const dx = tower.position.x - other.position.x;
                    const dy = tower.position.y - other.position.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= rangeSq) {
                        candidates.push({ enemy: other, distSq });
                    }
                }
                if (candidates.length > 0) {
                    candidates.sort((a, b) => a.distSq - b.distSq);
                    const count = Math.min(2, candidates.length);
                    tower.extraTargetIds = [];
                    for (let i = 0; i < count; i++) {
                        const target = candidates[i].enemy;
                        targets.push(target);
                        tower.extraTargetIds.push(target.id);
                    }
                }
            }
            const spectrumActive = golden > 0;
            for (const target of targets) {
                let dmg = mainDamage;
                if (target !== enemy) {
                    dmg = Math.floor(dmg * 0.5); // Secondary targets take 50%
                }
                if (target.prismVulnerableTime && target.prismVulnerableTime > 0) {
                    dmg = Math.floor(dmg * 1.15);
                }
                this.damageService.applyDamage(target, dmg, tower.type, this.wave(), tower.id, this.recordDamage.bind(this));
                if (spectrumActive) {
                    target.prismVulnerableTime = Math.max(target.prismVulnerableTime ?? 0, 0.25);
                }
            }
            enemy.prismVulnerableTime = 0.5; // Always apply to main target? Original code logic was slightly duplicated.
            // Original code: "enemy.prismVulnerableTime = 0.5;" at end of block.
        }

        if (tower.type === 4) {
            const golden = this.getUpgradeLevel(4, 'golden');
            if (golden > 0) {
                let chainChance = 0.1;
                if (golden === 2) chainChance = 0.15;
                else if (golden >= 3) chainChance = 0.2;

                if (Math.random() < chainChance) {
                    let closest: Enemy | null = null;
                    let minDist = Infinity;
                    for (const other of this.enemiesInternal) {
                        if (other.id === enemy.id || other.hp <= 0) continue;
                        const dx = enemy.position.x - other.position.x;
                        const dy = enemy.position.y - other.position.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist <= 3 && dist < minDist) {
                            minDist = dist;
                            closest = other;
                        }
                    }
                    if (closest) {
                        const chainProj: Projectile = {
                            id: 'p' + (this.projectileIdCounter++),
                            from: { ...tower.position },
                            to: { ...closest.position },
                            progress: 0,
                            speedMultiplier: this.getProjectileSpeedMultiplierForTower(tower)
                        };
                        this.pushProjectile(chainProj);

                        let secondaryDamage = tower.damage;
                        if (tower.specialActive) {
                            const ratio2 = closest.hp / closest.maxHp;
                            if (ratio2 < 0.3) {
                                const multiplier2 = closest.isBoss ? 3 : 2;
                                secondaryDamage = Math.floor(tower.damage * multiplier2);
                            }
                        }
                        if (closest.prismVulnerableTime && closest.prismVulnerableTime > 0) {
                            secondaryDamage = Math.floor(secondaryDamage * 1.15);
                        }
                        this.damageService.applyDamage(closest, secondaryDamage, tower.type, this.wave(), tower.id, this.recordDamage.bind(this));
                    }
                }
            }
        }
    }

    private updateProjectiles(dt: number) {
        // Advance and cleanup projectiles immediately when they finish
        for (let i = this.projectilesInternal.length - 1; i >= 0; i--) {
            const p = this.projectilesInternal[i];
            const speedMultiplier = p.speedMultiplier ?? 1;
            p.progress += 5 * speedMultiplier * dt;
            if (p.progress >= 1) {
                this.projectilesInternal.splice(i, 1);
            }
        }
    }

    // Analytics
    private endGame(victory: boolean) {
        if (this.gameOver()) return;
        this.gameOver.set(true);
        this.isWaveInProgress.set(false);
        this.saveResultIfLoggedIn();
        this.logAnalytics(victory);
    }

    private logAnalytics(victory: boolean) {
        const towers = this.towersInternal;
        if (towers.length === 0) return;

        // 1. Group by Type and find MVP
        const mvpByType: Record<number, Tower> = {};

        for (const tower of towers) {
            const currentDamage = this.damageTracking.get(tower.id) || 0;

            const type = tower.type;
            const existingMVP = mvpByType[type];
            if (!existingMVP) {
                mvpByType[type] = tower;
            } else {
                const existingDamage = this.damageTracking.get(existingMVP.id) || 0;
                if (currentDamage > existingDamage) {
                    mvpByType[type] = tower;
                }
            }
        }

        // 2. Calculate Total Pool
        let totalBestDamage = 0;
        const mvpList = Object.values(mvpByType);
        for (const t of mvpList) {
            totalBestDamage += (this.damageTracking.get(t.id) || 0);
        }

        if (totalBestDamage === 0) return;

        // 3. Prepare Data
        const gameId = Date.now().toString();
        const levelId = this.currentLevelConfig()?.id || 'random';
        const user = this.firebase.user$();
        const userId = user?.uid || 'guest';
        const gameVersion = '0.0.2';
        const isHardMode = this.isHardMode();

        // console.group('Game Balance Analytics');
        // console.log(`Game ID: ${gameId}, Result: ${victory ? 'WIN' : 'LOSE'}`);

        const logs = mvpList.map(t => {
            const dmg = this.damageTracking.get(t.id) || 0;
            const percent = (dmg / totalBestDamage) * 100;
            return {
                gameId,
                levelId,
                towerType: t.type,
                towerTier: t.level, // Assuming 'level' is upgrade tier 1-4
                damagePercent: parseFloat(percent.toFixed(2)),
                damageRaw: dmg,
                userId,
                gameVersion,
                result: victory ? 'WIN' : 'LOSE',
                timestamp: new Date(),
                isHardMode
            };
        });

        // console.table(logs);
        // console.groupEnd();

        this.firebase.saveBalanceLogs(logs);
    }

    // Logic for "Buy MAX"
    // Calculates total cost to reach max level (4) or as high as possible
    // Returns { levelsToAdd: number, totalCost: number }
    calculateMaxUpgrade(tower: Tower): { levelsToAdd: number, totalCost: number } {
        if (!tower || tower.level >= 4) return { levelsToAdd: 0, totalCost: 0 };

        let currentLevel = tower.level;
        let totalCost = 0;
        let levelsToAdd = 0;
        let money = this.money();
        const baseCost = this.getTowerCost(tower.type);

        while (currentLevel < 4) {
            // Match logic in getUpgradeCost exactly
            let multiplier = 0.5;
            if (currentLevel === 2) multiplier = 0.6;
            if (currentLevel === 3) multiplier = 0.7;

            const nextCost = Math.floor(baseCost * multiplier);

            if (money >= nextCost) {
                totalCost += nextCost;
                money -= nextCost;
                currentLevel++;
                levelsToAdd++;
            } else {
                break;
            }
        }

        return { levelsToAdd, totalCost };
    }

    upgradeTowerMax(towerId: string) {
        const tower = this.towersInternal.find(t => t.id === towerId);
        if (!tower) return;

        const { levelsToAdd, totalCost } = this.calculateMaxUpgrade(tower);
        if (levelsToAdd === 0) return;

        this.money.update(m => m - totalCost);

        // Apply upgrades level by level to ensure correct stats
        const baseCost = this.getTowerCost(tower.type);

        for (let i = 0; i < levelsToAdd; i++) {
            // Calculate cost for this specific level step for invested tracking
            let multiplier = 0.5;
            if (tower.level === 2) multiplier = 0.6;
            if (tower.level === 3) multiplier = 0.7;
            const cost = Math.floor(baseCost * multiplier);

            tower.level++;
            tower.damage = Math.floor(tower.damage * 1.3); // Match standard upgrade (1.3x)
            tower.range = parseFloat((tower.range * 1.1).toFixed(2)); // Match standard upgrade (1.1x)
            tower.invested += cost;
        }
    }

    getTowerCost(tier: number): number {
        return TOWER_COSTS[tier - 1] ?? 999999;
    }

    buyTower(x: number, y: number, tier: number) {
        // Check allowed towers
        if (this.gameMode() === 'campaign') {
            const allowed = this.allowedTowers();
            if (!allowed.includes(tier)) return;
        }

        let cost = this.getTowerCost(tier);

        if (this.money() < cost) return;

        this.grid.update(grid => {
            const tile = grid[y][x];
            if (tile.type === 'buildable' && !tile.tower) {
                const stats = TIER_STATS[tier - 1];
                const dmgLevel = this.getUpgradeLevel(tier, 'damage');
                const rangeLevel = this.getUpgradeLevel(tier, 'range');
                const goldenLevel = this.getUpgradeLevel(tier, 'golden');
                let damageMultiplier = 1 + dmgLevel * 0.05;
                let rangeBonus = rangeLevel * 0.1;

                // Apply Tile Bonuses
                if (tile.bonus === 'damage') {
                    damageMultiplier += 0.2; // +20% Damage
                } else if (tile.bonus === 'range') {
                    rangeBonus += 0.5; // +0.5 Range
                } else if (tile.bonus === 'mastery') {
                    // Mastery bonus logic can be applied here or in specific tower logic
                    // For now, let's treat it as a small global buff for this tower
                    damageMultiplier += 0.1;
                }

                let finalFireInterval = stats.fireInterval;
                if (tile.bonus === 'speed') {
                    finalFireInterval *= 0.65; // -35% Cooldown (35% faster)
                }

                tile.tower = {
                    id: crypto.randomUUID(),
                    type: tier,
                    level: 1,
                    position: { x, y },
                    baseCost: cost,
                    invested: cost,
                    damage: Math.floor(stats.damage * damageMultiplier),
                    range: stats.range + rangeBonus,
                    fireInterval: finalFireInterval,
                    cooldown: 0,
                    specialActive: false,
                    strategy: 'first',
                    hasGolden: goldenLevel > 0,
                    description: this.getTowerDescription(tier)
                };
                this.towersInternal.push(tile.tower);
                this.money.update(m => m - cost);
            }
            return [...grid];
        });
    }

    upgradeTower(x: number, y: number) {
        this.grid.update(grid => {
            const tile = grid[y][x];
            if (tile.tower && tile.tower.level < 4) {
                const cost = this.getUpgradeCost(tile.tower);
                if (this.money() >= cost) {
                    tile.tower.level++;
                    tile.tower.damage = Math.floor(tile.tower.damage * 1.3);
                    // More conservative range upgrade: +10% instead of flat +0.5
                    tile.tower.range = parseFloat((tile.tower.range * 1.1).toFixed(2));
                    tile.tower.invested += cost;
                    this.money.update(m => m - cost);
                }
            }
            return [...grid];
        });
    }

    getUpgradeCost(tower: Tower): number {
        let multiplier = 0.5;
        switch (tower.level) {
            case 1:
                multiplier = 0.5;
                break;
            case 2:
                multiplier = 0.6;
                break;
            case 3:
                multiplier = 0.7;
                break;
        }
        // Use constant cost for integrity
        const baseCost = this.getTowerCost(tower.type);
        return Math.floor(baseCost * multiplier);
    }

    getSpecialCost(tower: Tower): number {
        // Recalculate base cost from constant to avoid tampering with tower.baseCost
        const baseCost = this.getTowerCost(tower.type);
        return baseCost * 4;
    }

    getTowerDescription(tier: number): string {
        const isUk = this.settings.currentLang() === 'uk';

        switch (tier) {
            case 1:
                return isUk ? 'Сповільнює ворогів у радіусі дії'
                    : 'Slows enemies in range';
            case 2:
                return isUk ? 'Уражає ланцюговою блискавкою декілька цілей'
                    : 'Chains lightning to nearby enemies';
            case 3:
                return isUk ? 'Посилює шкоду за рахунок ефекту розколу'
                    : 'Amplifies damage with shatter stacks';
            case 4:
                return isUk ? 'Завдає бонусну шкоду по поранених ворогах'
                    : 'Deals bonus damage to weakened enemies';
            case 5:
                return isUk ? 'AOE шкода по області та зони горіння'
                    : 'Splash AOE damage and burning zones';
            case 6:
                return isUk ? 'Промінь, що посилюється, та ланцюгова атака'
                    : 'Beam ramps damage and chains with golden';
            case 7:
                return isUk ? 'Накладає ефекти отрути з поступовим зростанням шкоди'
                    : 'Applies venom stacks and poison DOT';
            default:
                return isUk ? 'Стандартна вежа'
                    : 'Standard tower';
        }
    }

    buyAbility(x: number, y: number) {
        this.grid.update(grid => {
            const tile = grid[y][x];
            if (tile.tower && tile.tower.level === 4 && !tile.tower.specialActive) {
                const cost = this.getSpecialCost(tile.tower);
                if (this.money() >= cost) {
                    tile.tower.specialActive = true;
                    tile.tower.invested += cost;
                    this.money.update(m => m - cost);
                }
            }
            return [...grid.map(row => [...row])];
        });
    }

    setTowerStrategy(x: number, y: number, strategy: 'first' | 'weakest' | 'strongest' | 'random') {
        this.grid.update(grid => {
            const row = grid[y];
            if (!row) return grid;
            const tile = row[x];
            if (tile && tile.tower) {
                tile.tower.strategy = strategy;
            }
            return [...grid];
        });
    }

    sellTower(x: number, y: number) {
        this.grid.update(grid => {
            const tile = grid[y][x];
            if (tile.tower) {
                // Refund 60% of total investment
                const invested = tile.tower.invested ?? tile.tower.baseCost;
                const refund = Math.floor(invested * 0.6);
                const id = tile.tower.id;
                tile.tower = null;
                this.money.update(m => m + refund);
                const idx = this.towersInternal.findIndex(t => t.id === id);
                if (idx !== -1) this.towersInternal.splice(idx, 1);
            }
            return [...grid];
        });
    }

    // Renderer-friendly accessors (return references without allocations)
    getEnemiesRef(): readonly Enemy[] { return this.enemiesInternal; }
    getProjectilesRef(): readonly Projectile[] { return this.projectilesInternal; }
    getTowersRef(): readonly Tower[] { return this.towersInternal; }
    getInfernoZonesRef(): readonly InfernoZone[] { return this.infernoZones; }
    getPathRef(): readonly Position[] { return this.path(); }
    getGridRef(): readonly TDTile[][] { return this.grid(); }
}
