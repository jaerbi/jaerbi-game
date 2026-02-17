import { Injectable, signal, computed } from '@angular/core';
import { NgZone } from '@angular/core';
import { FirebaseService } from './firebase.service';
import { Enemy, Position, Projectile, TDTile, TileType, Tower } from '../models/unit.model';
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

    gridSize = 10;
    grid = signal<TDTile[][]>([]);
    path = signal<Position[]>([]);
    readonly tileSize = 62;

    enemies = signal<Enemy[]>([]);
    projectiles = signal<Projectile[]>([]);
    gameSpeedMultiplier = signal(1);

    private enemiesInternal: Enemy[] = [];
    private projectilesInternal: Projectile[] = [];
    private towersInternal: Tower[] = [];
    private enemyIdCounter = 1;
    private projectileIdCounter = 1;

    readonly uiTick$ = new Subject<void>();

    private animationFrameId: number | null = null;
    private lastUpdateTime = 0;
    private lastUiPublishTime = 0;
    private enemiesToSpawn = 0;
    private currentWaveEnemyCount = 0;
    private spawnTimer = 0;
    private spawnInterval = 1000;

    // Costs and Stats
    towerCosts = [15, 50, 250, 1500];

    private tierStats = [
        { damage: 5, range: 2, fireInterval: 0.5 },
        { damage: 20, range: 2.5, fireInterval: 1 },
        { damage: 80, range: 3, fireInterval: 2 },
        { damage: 300, range: 3.5, fireInterval: 3 }
    ];

    private savedResult = false;

    constructor(private ngZone: NgZone, private firebase: FirebaseService) {
        this.initGame();
    }

    private async saveResultIfLoggedIn() {
        const user = this.firebase.user$();
        if (!user) return;
        const payload = {
            userId: user.uid,
            displayName: user.displayName || 'Anonymous',
            maxWave: this.wave(),
            totalMoney: this.money()
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
        this.enemiesToSpawn = 0;
        this.currentWaveEnemyCount = 0;
        this.spawnTimer = 0;
        this.enemies.set([]);
        this.projectiles.set([]);
        this.isWaveInProgress.set(false);
        this.gameOver.set(false);
        this.savedResult = false;
        this.money.set(100);
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
        this.dispose();
        this.generateMap();
    }

    private generateRandomPath(): Position[] {
        const maxIndex = this.gridSize - 1;
        const path: Position[] = [{ x: 0, y: 0 }];
        let current = { x: 0, y: 0 };
        const target = { x: maxIndex, y: maxIndex };

        // Improved path generation with turns
        while (current.x !== target.x || current.y !== target.y) {
            const possible: Position[] = [];

            // Move toward target but allow some deviation
            if (current.x < target.x) possible.push({ x: current.x + 1, y: current.y });
            if (current.y < target.y) possible.push({ x: current.x, y: current.y + 1 });

            // Add more weight to one direction to create "segments"
            let next;
            if (possible.length > 1) {
                // 80% chance to continue in same direction if possible
                const last = path.length > 1 ? path[path.length - 2] : null;
                const dx = last ? current.x - last.x : 1;
                const dy = last ? current.y - last.y : 0;

                const preferred = possible.find(p => p.x - current.x === dx && p.y - current.y === dy);
                if (preferred && Math.random() < 0.8) {
                    next = preferred;
                } else {
                    next = possible[Math.floor(Math.random() * possible.length)];
                }
            } else {
                next = possible[0];
            }

            path.push(next);
            current = next;
        }

        return path;
    }

    startWave() {
        if (this.isWaveInProgress() || this.gameOver()) return;
        this.wave.update(w => w + 1);
        this.isWaveInProgress.set(true);

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
            }
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
        }
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

        const hpFinal = boss ? hp * 3 : hp;
        const speedFinal = boss ? baseSpeed * 0.5 : baseSpeed;

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
            isFrozen: false
        };
        this.enemiesInternal.push(newEnemy);
    }

    private updateEnemies(dt: number) {
        for (let i = this.enemiesInternal.length - 1; i >= 0; i--) {
            const enemy = this.enemiesInternal[i];
            enemy.speedModifier = 1;
            enemy.isFrozen = false;
        }

        this.applyFrostAuras();

        const tile = this.tileSize;

        for (let i = this.enemiesInternal.length - 1; i >= 0; i--) {
            const enemy = this.enemiesInternal[i];
            const moveSpeed = enemy.baseSpeed * enemy.speedModifier;
            enemy.progress += moveSpeed * dt;

            if (enemy.progress >= 1) {
                enemy.pathIndex++;
                enemy.progress = 0;

                if (enemy.pathIndex >= this.path().length - 1) {
                    this.enemiesInternal.splice(i, 1);
                    this.ngZone.run(() => this.lives.update(l => Math.max(0, l - 1)));
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
            const lightness = shatter > 0 ? Math.min(70, 50 + shatter * 4) : 50;
            enemy.scale = enemy.isBoss ? 1.5 : 1;
            enemy.bg = enemy.isFrozen ? `hsl(190, 80%, ${lightness}%)` : `hsl(${enemy.hue}, 70%, ${lightness}%)`;

            if (enemy.hp <= 0) {
                this.enemiesInternal.splice(i, 1);
                this.ngZone.run(() => this.money.update(m => m + 5 + this.wave()));
            }
        }
    }

    private updateTowers(dt: number) {
        if (this.enemiesInternal.length === 0 || this.towersInternal.length === 0) return;
        for (const tower of this.towersInternal) {
            tower.cooldown -= dt;
            if (tower.cooldown <= 0) {
                const target = this.findNearestEnemy(tower, this.enemiesInternal);
                if (target) {
                    this.fireAt(tower, target);
                    tower.cooldown = tower.fireInterval;
                } else {
                    tower.cooldown = 0;
                }
            }
        }
    }

    private applyFrostAuras() {
        if (this.enemiesInternal.length === 0) return;

        const frostTowers = this.towersInternal.filter(t => t.type === 1 && t.specialActive);
        if (frostTowers.length === 0) return;

        const radiusSq = 4;

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
                enemy.speedModifier = 0.7;
                enemy.isFrozen = true;
            }
        }
    }

    private findNearestEnemy(tower: Tower, enemies: Enemy[]): Enemy | null {
        let nearest: Enemy | null = null;
        let minDistSq = tower.range * tower.range;

        for (const enemy of enemies) {
            const dx = tower.position.x - enemy.position.x;
            const dy = tower.position.y - enemy.position.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= minDistSq) {
                minDistSq = distSq;
                nearest = enemy;
            }
        }
        return nearest;
    }

    private pushProjectile(p: Projectile) {
        if (this.projectilesInternal.length >= 100) {
            this.projectilesInternal.shift();
        }
        this.projectilesInternal.push(p);
    }

    private fireAt(tower: Tower, enemy: Enemy) {
        const proj: Projectile = {
            id: 'p' + (this.projectileIdCounter++),
            from: { ...tower.position },
            to: { ...enemy.position },
            progress: 0
        };
        this.pushProjectile(proj);

        let damage = tower.damage;

        if (tower.specialActive && tower.type === 4) {
            const ratio = enemy.hp / enemy.maxHp;
            if (ratio < 0.15) {
                if (enemy.isBoss) {
                    damage = tower.damage * 3;
                } else {
                    enemy.hp = 0;
                    return;
                }
            }
        }

        if (tower.specialActive && tower.type === 3) {
            const nextStacks = Math.min(5, enemy.shatterStacks + 1);
            enemy.shatterStacks = nextStacks;
            const multiplier = 1 + nextStacks * 0.1;
            damage = Math.floor(damage * multiplier);
        }

        enemy.hp -= damage;

        if (tower.specialActive && tower.type === 2) {
            if (Math.random() < 0.25) {
                const secondary: Enemy[] = [];
                for (const other of this.enemiesInternal) {
                    if (other.id === enemy.id) continue;
                    const dx = enemy.position.x - other.position.x;
                    const dy = enemy.position.y - other.position.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= 3) {
                        secondary.push(other);
                        if (secondary.length >= 2) break;
                    }
                }
                const secondaryDamage = Math.floor(tower.damage * 0.5);
                for (const s of secondary) {
                    const chainProj: Projectile = {
                        id: 'p' + (this.projectileIdCounter++),
                        from: { ...tower.position },
                        to: { ...s.position },
                        progress: 0
                    };
                    this.pushProjectile(chainProj);
                    s.hp -= secondaryDamage;
                }
            }
        }
    }

    private updateProjectiles(dt: number) {
        // Advance and cleanup projectiles immediately when they finish
        for (let i = this.projectilesInternal.length - 1; i >= 0; i--) {
            const p = this.projectilesInternal[i];
            p.progress += 5 * dt;
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
                tile.tower = {
                    id: crypto.randomUUID(),
                    type: tier,
                    level: 1,
                    position: { x, y },
                    baseCost: cost,
                    invested: cost,
                    damage: stats.damage,
                    range: stats.range,
                    fireInterval: stats.fireInterval,
                    cooldown: 0,
                    specialActive: false
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
    getPathRef(): readonly Position[] { return this.path(); }
    getGridRef(): readonly TDTile[][] { return this.grid(); }
}
