import { Injectable, signal, computed } from '@angular/core';
import { NgZone } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { Enemy, InfernoZone, Position, Projectile, TDTile, TileType, Tower } from '../models/unit.model';
import { Subject } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class TowerDefenseEngineService {
    // Game State
    money = signal(100);
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

    // Costs and Stats
    towerCosts = [15, 50, 250, 1000, 1500, 2500];

    private tierStats = [
        { damage: 5, range: 2, fireInterval: 0.5 },
        { damage: 20, range: 2.5, fireInterval: 0.8 },
        { damage: 80, range: 3, fireInterval: 1 },
        { damage: 300, range: 3.5, fireInterval: 1.2 },
        { damage: 80, range: 3.5, fireInterval: 2.0 },
        { damage: 20, range: 4.5, fireInterval: 0.2 }
    ];

    private savedResult = false;
    private gameEndedHard = false;

    constructor(private ngZone: NgZone, private firebase: FirebaseService) {
        this.initGame();
    }

    private async saveResultIfLoggedIn() {
        const user = this.firebase.user$();
        if (!user) return;
        const mapSizeLabel = this.gridSize === 20 ? '20x20' : '10x10';
        const payload = {
            userId: user.uid,
            displayName: user.displayName || 'Anonymous',
            maxWave: this.wave(),
            totalMoney: this.money(),
            mapSize: mapSizeLabel
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
        this.money.set(100000);
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

    generateMap() {
        const newPath = this.generateRandomPath();
        this.path.set(newPath);

        const newGrid: TDTile[][] = [];
        this.towersInternal = [];
        const pathSet = new Set(newPath.map(p => `${p.x},${p.y}`));

        for (let y = 0; y < this.gridSize; y++) {
            const row: TDTile[] = [];
            for (let x = 0; x < this.gridSize; x++) {
                let type: TileType = 'void';
                if (pathSet.has(`${x},${y}`)) {
                    type = 'path';
                } else {
                    // Check if adjacent to path
                    const neighbors = [
                        { x: x - 1, y }, { x: x + 1, y }, { x, y: y - 1 }, { x, y: y + 1 }
                    ];
                    if (neighbors.some(n => pathSet.has(`${n.x},${n.y}`))) {
                        type = 'buildable';
                    }
                }

                row.push({ x, y, type, tower: null });
            }
            newGrid.push(row);
        }
        this.grid.set(newGrid);
    }

    initializeGame(level: number) {
        this.gridSize = level === 2 ? 20 : 10;
        if (this.gridSize === 10) {
            this.tileSize = 62;
        } else if (this.gridSize === 20) {
            this.tileSize = 32;
        } else {
            this.tileSize = 32;
        }
        this.dispose();
        this.generateMap();
        this.nextWaveEnemyType.set(this.determineWaveType(1));
        const goldLevel = this.getGoldMasteryLevel();
        if (goldLevel >= 8) {
            const bonus = (goldLevel - 7) * 20;
            this.money.set(100 + bonus);
        }
    }

    private determineWaveType(wave: number): 'tank' | 'scout' | 'standard' {
        if (wave <= 2) {
            return 'standard';
        }
        if (wave <= 8) {
            return Math.random() < 0.5 ? 'scout' : 'standard';
        }
        const roll = Math.random();
        if (roll < 0.23) return 'tank';
        if (roll < 0.56) return 'scout';
        return 'standard';
    }

    private getGoldMasteryLevel(): number {
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

    startWave() {
        if (this.isWaveInProgress() || this.gameOver()) return;
        this.wave.update(w => w + 1);
        this.isWaveInProgress.set(true);
        this.currentWaveType = this.nextWaveEnemyType();
        this.nextWaveEnemyType.set(this.determineWaveType(this.wave() + 1));

        const enemyCount = 5 + this.wave() * 2;
        this.enemiesToSpawn = enemyCount;
        this.currentWaveEnemyCount = enemyCount;
        this.spawnTimer = 0;

        this.startGameLoop();
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
        if (this.gameEndedHard) {
            return;
        }
        const effectiveDt = dt * this.gameSpeedMultiplier();
        this.handleSpawning(effectiveDt);
        this.updateEnemies(effectiveDt);
        this.updateTowers(effectiveDt);
        this.updateProjectiles(effectiveDt);

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
                const wavesCleared = this.wave();
                let xp = 0;
                if (wavesCleared >= 5) {
                    const base = wavesCleared * 1.5;
                    const bonus = wavesCleared > 20 ? (wavesCleared - 20) * 2 : 0;
                    xp = Math.floor(base + bonus);
                }
                if (xp > 0) {
                    this.firebase.awardTowerDefenseXp(xp);
                }
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

    private getUpgradeLevel(tier: number, kind: 'damage' | 'range' | 'golden'): number {
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
                enemy.hp -= damage;
            }
        }
        const explosion: InfernoZone = {
            id: 'z' + (this.projectileIdCounter++),
            position: { ...pos },
            radius,
            remaining: 0.3,
            dps: 0
        };
        this.infernoZones.push(explosion);
    }

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
        const hp = 50 * Math.pow(1.2, this.wave());
        const baseSpeed = 0.5 + (this.wave() * 0.05);
        const total = this.currentWaveEnemyCount || (5 + this.wave() * 2);
        const spawnedSoFar = total - this.enemiesToSpawn;
        const isBossWave = this.wave() % 5 === 0;
        const isLastOfWave = spawnedSoFar === total - 1;
        const boss = isBossWave && isLastOfWave;
        const hue = (this.wave() * 40) % 360;

        let enemyType: 'tank' | 'scout' | 'standard' | 'boss' = this.currentWaveType;
        if (boss) {
            enemyType = 'boss';
        }

        let hpFinal = hp;
        let speedFinal = baseSpeed;
        if (enemyType === 'tank') {
            hpFinal = hp * 2;
            speedFinal = baseSpeed * 0.5;
        } else if (enemyType === 'scout') {
            hpFinal = hp * 0.4;
            speedFinal = baseSpeed * 2.0;
        } else if (enemyType === 'boss') {
            hpFinal = hp * 3;
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
                        enemy.hp -= zone.dps * dt;
                        enemy.burnedByInferno = true;
                    }
                }
            }
        }

        for (let i = this.enemiesInternal.length - 1; i >= 0; i--) {
            const enemy = this.enemiesInternal[i];
            if (enemy.stunTime && enemy.stunTime > 0) {
                const path = this.path();
                const current = path[enemy.pathIndex];
                const next = path[enemy.pathIndex + 1] || current;
                const ix = current.x + (next.x - current.x) * enemy.progress;
                const iy = current.y + (next.y - current.y) * enemy.progress;
                enemy.displayX = (ix + 0.5) * tile;
                enemy.displayY = (iy + 0.5) * tile;
                continue;
            }
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
                    this.enemiesInternal.splice(i, 1);
                    this.ngZone.run(() => this.lives.update(l => Math.max(0, l - 1)));
                    if (this.enemiesInternal.length === 0 && this.enemiesToSpawn === 0) {
                        this.currentWaveType = 'standard';
                    }
                    continue;
                }
                enemy.position = { ...this.path()[enemy.pathIndex] };
            }

            const path = this.path();
            const current = path[enemy.pathIndex];
            const next = path[enemy.pathIndex + 1] || current;
            const ix = current.x + (next.x - current.x) * enemy.progress;
            const iy = current.y + (next.y - current.y) * enemy.progress;
            enemy.displayX = (ix + 0.5) * tile;
            enemy.displayY = (iy + 0.5) * tile;
            const shatter = enemy.shatterStacks ?? 0;
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
                const baseReward = 5 + this.wave();
                const goldMultiplier = this.getGoldKillMultiplier();
                let reward = Math.floor(baseReward * goldMultiplier);
                if (this.isHardMode()) {
                    reward = Math.floor(reward * 0.8);
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
                    tower.cooldown = tower.fireInterval;
                } else {
                    tower.targetEnemyId = undefined;
                    tower.beamTime = 0;
                    tower.lastBeamTargetId = undefined;
                    tower.extraTargetIds = undefined;
                    tower.cooldown = 0;
                }
            }
        }
    }

    private applyFrostAuras() {
        if (this.enemiesInternal.length === 0) return;

        const frostTowers = this.towersInternal.filter(t => t.type === 1 && t.specialActive);
        if (frostTowers.length === 0) return;

        const golden = this.getUpgradeLevel(1, 'golden');
        const auraMultiplier = 1 + golden * 0.1;
        const baseRadius = 2;
        const radius = baseRadius * auraMultiplier;
        const radiusSq = radius * radius;
        const slowMultiplier = 0.7 * (1 - golden * 0.05);

        for (const enemy of this.enemiesInternal) {
            let isSlowed = false;

            for (const tower of frostTowers) {
                const dx = tower.position.x - enemy.position.x;
                const dy = tower.position.y - enemy.position.y;
                if (dx * dx + dy * dy <= radiusSq) {
                    isSlowed = true;
                    break;
                }
            }

            if (isSlowed) {
                enemy.speedModifier = slowMultiplier;
                enemy.isFrozen = true;
            }
        }
    }

    private findTargetForTower(tower: Tower, enemies: Enemy[]): Enemy | null {
        const rangeSq = tower.range * tower.range;
        const path = this.path();
        const candidates: { enemy: Enemy; distSq: number; progressScore: number }[] = [];

        for (const enemy of enemies) {
            const dx = tower.position.x - enemy.position.x;
            const dy = tower.position.y - enemy.position.y;
            const distSq = dx * dx + dy * dy;
            if (distSq > rangeSq) continue;
            const idx = enemy.pathIndex ?? 0;
            const prog = enemy.progress ?? 0;
            const progressScore = idx + prog;
            candidates.push({ enemy, distSq, progressScore });
        }

        if (candidates.length === 0) return null;

        const strat = tower.strategy || 'first';

        if (strat === 'random') {
            const r = Math.floor(Math.random() * candidates.length);
            return candidates[r].enemy;
        }

        if (strat === 'weakest') {
            let best = candidates[0];
            for (let i = 1; i < candidates.length; i++) {
                if (candidates[i].enemy.hp < best.enemy.hp) {
                    best = candidates[i];
                }
            }
            return best.enemy;
        }

        if (strat === 'strongest') {
            let best = candidates[0];
            for (let i = 1; i < candidates.length; i++) {
                if (candidates[i].enemy.hp > best.enemy.hp) {
                    best = candidates[i];
                }
            }
            return best.enemy;
        }

        let best = candidates[0];
        for (let i = 1; i < candidates.length; i++) {
            if (candidates[i].progressScore > best.progressScore) {
                best = candidates[i];
            }
        }
        return best.enemy;
    }

    private pushProjectile(p: Projectile) {
        if (this.projectilesInternal.length >= 100) {
            this.projectilesInternal.shift();
        }
        this.projectilesInternal.push(p);
    }

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

        let damage = tower.damage;

        if (tower.specialActive && tower.type === 4) {
            const ratio = enemy.hp / enemy.maxHp;
            if (ratio < 0.5) {
                const multiplier = enemy.isBoss ? 3 : 2;
                damage = Math.floor(tower.damage * multiplier);
            }
        }

        if (tower.specialActive && tower.type === 3) {
            const nextStacks = Math.min(5, enemy.shatterStacks + 1);
            enemy.shatterStacks = nextStacks;
            const multiplier = 1 + nextStacks * 0.2;
            damage = Math.floor(damage * multiplier);
        }

        if (tower.type === 6) {
            const sameTarget = tower.lastBeamTargetId === enemy.id;
            const prevTime = tower.beamTime ?? 0;
            const newTime = sameTarget ? prevTime + tower.fireInterval : tower.fireInterval;
            tower.beamTime = newTime;
            tower.lastBeamTargetId = enemy.id;
            const golden = this.getUpgradeLevel(6, 'golden');
            const maxBonus = golden > 0 ? 3 : 1;
            const ramp = 1 + Math.min(maxBonus, newTime * 0.5);
            damage = Math.floor(damage * ramp);
        }

        if (enemy.prismVulnerableTime && enemy.prismVulnerableTime > 0) {
            damage = Math.floor(damage * 1.15);
        }

        if (tower.type === 5) {
            const radius = 1.5;
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
                    other.hp -= aoeDamage;
                    other.burnedByInferno = true;
                }
            }
            if (tower.specialActive) {
                const zone: InfernoZone = {
                    id: 'z' + (this.projectileIdCounter++),
                    position: { ...basePos },
                    radius,
                    remaining: 4,
                    dps: tower.damage * 0.5
                };
                this.infernoZones.push(zone);
            }
        } else if (tower.type !== 6 || !tower.specialActive) {
            enemy.hp -= damage;
        }

        if (tower.type === 3) {
            const golden = this.getUpgradeLevel(3, 'golden');
            if (golden > 0) {
                const stunChance = 0.15 + golden * 0.05;
                if (Math.random() < stunChance) {
                    const baseDuration = (0.5 + golden * 0.2) * 1.2;
                    enemy.stunTime = Math.max(enemy.stunTime ?? 0, baseDuration);
                }
            }
        }

        if (tower.specialActive && tower.type === 2) {
            const golden = this.getUpgradeLevel(2, 'golden');
            const triggerChance = 0.25 + golden * 0.05;
            const damageMultiplier = 1.5 + golden * 0.2;
            if (Math.random() < triggerChance) {
                const candidates: { enemy: Enemy; distSq: number }[] = [];
                for (const other of this.enemiesInternal) {
                    if (other.id === enemy.id || other.hp <= 0) continue;
                    const dx = enemy.position.x - other.position.x;
                    const dy = enemy.position.y - other.position.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= 9) {
                        candidates.push({ enemy: other, distSq });
                    }
                }
                if (candidates.length > 0) {
                    candidates.sort((a, b) => a.distSq - b.distSq);
                    const count = Math.min(2, candidates.length);
                    for (let i = 0; i < count; i++) {
                        const target = candidates[i].enemy;
                        const chainProj: Projectile = {
                            id: 'p' + (this.projectileIdCounter++),
                            from: { ...tower.position },
                            to: { ...target.position },
                            progress: 0,
                            speedMultiplier: this.getProjectileSpeedMultiplierForTower(tower)
                        };
                        this.pushProjectile(chainProj);
                        const secondaryDamage = Math.floor(tower.damage * damageMultiplier);
                        target.hp -= secondaryDamage;
                    }
                }
            }
        }

        if (tower.specialActive && tower.type === 6) {
            const golden = this.getUpgradeLevel(6, 'golden');
            const sameTarget = tower.lastBeamTargetId === enemy.id;
            const time = tower.beamTime ?? 0;
            const maxBonus = golden > 0 ? 3 : 1;
            const ramp = 1 + Math.min(maxBonus, time * 0.5);
            const mainDamage = Math.floor(tower.damage * ramp);
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
                if (target.prismVulnerableTime && target.prismVulnerableTime > 0) {
                    dmg = Math.floor(dmg * 1.15);
                }
                target.hp -= dmg;
                if (spectrumActive) {
                    target.prismVulnerableTime = Math.max(target.prismVulnerableTime ?? 0, 0.25);
                }
            }
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
                            if (ratio2 < 0.5) {
                                const multiplier2 = closest.isBoss ? 3 : 2;
                                secondaryDamage = Math.floor(tower.damage * multiplier2);
                            }
                        }
                        if (closest.prismVulnerableTime && closest.prismVulnerableTime > 0) {
                            secondaryDamage = Math.floor(secondaryDamage * 1.15);
                        }
                        closest.hp -= secondaryDamage;
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

    buyTower(x: number, y: number, tier: number) {
        const cost = this.towerCosts[tier - 1];
        if (this.money() < cost) return;

        this.grid.update(grid => {
            const tile = grid[y][x];
            if (tile.type === 'buildable' && !tile.tower) {
                const stats = this.tierStats[tier - 1];
                const dmgLevel = this.getUpgradeLevel(tier, 'damage');
                const rangeLevel = this.getUpgradeLevel(tier, 'range');
                const goldenLevel = this.getUpgradeLevel(tier, 'golden');
                const damageMultiplier = 1 + dmgLevel * 0.05;
                const rangeBonus = rangeLevel * 0.1;
                tile.tower = {
                    id: crypto.randomUUID(),
                    type: tier,
                    level: 1,
                    position: { x, y },
                    baseCost: cost,
                    invested: cost,
                    damage: Math.floor(stats.damage * damageMultiplier),
                    range: stats.range + rangeBonus,
                    fireInterval: stats.fireInterval,
                    cooldown: 0,
                    specialActive: false,
                    strategy: 'first',
                    hasGolden: goldenLevel > 0
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
                    tile.tower.range += 0.5;
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
        return Math.floor(tower.baseCost * multiplier);
    }

    getSpecialCost(tower: Tower): number {
        return tower.baseCost * 4;
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
                const invested = tile.tower.invested ?? tile.tower.baseCost;
                const refund = Math.floor(invested * 0.5);
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
