import { Injectable, signal } from '@angular/core';
import { NgZone } from '@angular/core';

export interface Position {
    x: number;
    y: number;
}

export type TileType = 'path' | 'buildable' | 'void';

export interface Tower {
    id: string;
    type: number;
    level: number;
    position: Position;
    baseCost: number;
    invested: number;
    damage: number;
    range: number;
    fireInterval: number;
    lastFired: number;
}

export interface Enemy {
    id: string;
    position: Position;
    pathIndex: number;
    hp: number;
    maxHp: number;
    speed: number;
    progress: number;
    isBoss?: boolean;
    hue: number;
}

export interface Projectile {
    id: string;
    from: Position;
    to: Position;
    progress: number;
}

export interface TDTile {
    x: number;
    y: number;
    type: TileType;
    tower: Tower | null;
}

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

    enemies = signal<Enemy[]>([]);
    projectiles = signal<Projectile[]>([]);

    private enemiesInternal: Enemy[] = [];
    private projectilesInternal: Projectile[] = [];

    private animationFrameId: number | null = null;
    private lastUpdateTime = 0;
    private enemiesToSpawn = 0;
    private currentWaveEnemyCount = 0;
    private spawnTimer = 0;
    private spawnInterval = 1000; // ms between spawns

    // Costs and Stats
    towerCosts = [15, 50, 150, 500];

    private tierStats = [
        { damage: 5, range: 2, fireInterval: 500 },
        { damage: 20, range: 3, fireInterval: 1000 },
        { damage: 80, range: 4, fireInterval: 2000 },
        { damage: 300, range: 6, fireInterval: 1000 }
    ];

    constructor(private ngZone: NgZone) {
        this.initGame();
    }

    stopGameLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    dispose() {
        this.stopGameLoop();
        this.enemiesInternal = [];
        this.projectilesInternal = [];
        this.enemiesToSpawn = 0;
        this.currentWaveEnemyCount = 0;
        this.spawnTimer = 0;
        this.enemies.set([]);
        this.projectiles.set([]);
        this.isWaveInProgress.set(false);
        this.gameOver.set(false);
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

    initGame() {
        this.dispose();
        this.generateMap();
    }

    resetGame() {
        this.initGame();
    }

    generateMap() {
        const newPath = this.generateRandomPath();
        this.path.set(newPath);

        const newGrid: TDTile[][] = [];
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

    private generateRandomPath(): Position[] {
        const path: Position[] = [{ x: 0, y: 0 }];
        let current = { x: 0, y: 0 };
        const target = { x: 9, y: 9 };

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
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.stopGameLoop();
        this.lastUpdateTime = performance.now();
        this.ngZone.runOutsideAngular(() => {
            const loop = (currentTime: number) => {
                const dt = (currentTime - this.lastUpdateTime) / 1000; // seconds
                this.lastUpdateTime = currentTime;

                this.updateGame(dt);
                // Publish a minimal snapshot once per frame
                this.ngZone.run(() => {
                    // Spread to ensure signal change detection with minimal work
                    this.enemies.set([...this.enemiesInternal]);
                    this.projectiles.set([...this.projectilesInternal]);
                });

                if (this.isWaveInProgress() || this.enemiesInternal.length > 0) {
                    this.animationFrameId = requestAnimationFrame(loop);
                } else {
                    this.ngZone.run(() => this.isWaveInProgress.set(false));
                    this.animationFrameId = null;
                }
            };
            this.animationFrameId = requestAnimationFrame(loop);
        });
    }

    updateGame(dt: number) {
        this.handleSpawning(dt);
        this.updateEnemies(dt);
        this.updateTowers(dt);
        this.updateProjectiles(dt);

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
            return;
        }

        if (this.enemiesInternal.length === 0 && this.enemiesToSpawn === 0 && this.isWaveInProgress()) {
            this.ngZone.run(() => this.isWaveInProgress.set(false));
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
            id: crypto.randomUUID(),
            position: { ...this.path()[0] },
            pathIndex: 0,
            hp: hpFinal,
            maxHp: hpFinal,
            speed: speedFinal,
            progress: 0,
            isBoss: boss,
            hue
        };
        this.enemiesInternal.push(newEnemy);
    }

    private updateEnemies(dt: number) {
        // In-place update; remove dead or escaped enemies
        for (let i = this.enemiesInternal.length - 1; i >= 0; i--) {
            const enemy = this.enemiesInternal[i];
            enemy.progress += enemy.speed * dt;

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

            if (enemy.hp <= 0) {
                this.enemiesInternal.splice(i, 1);
                this.ngZone.run(() => this.money.update(m => m + 5 + this.wave()));
            }
        }
    }

    private updateTowers(dt: number) {
        const now = Date.now();
        if (this.enemiesInternal.length === 0) return;
        const gridSnapshot = this.grid();
        for (const row of gridSnapshot) {
            for (const tile of row) {
                if (tile.tower) {
                    const tower = tile.tower;
                    if (now - tower.lastFired > tower.fireInterval) {
                        const target = this.findNearestEnemy(tower, this.enemiesInternal);
                        if (target) {
                            this.fireAt(tower, target);
                            tower.lastFired = now;
                        }
                    }
                }
            }
        }
    }

    private findNearestEnemy(tower: Tower, enemies: Enemy[]): Enemy | null {
        let nearest: Enemy | null = null;
        let minDist = tower.range;

        for (const enemy of enemies) {
            const dx = tower.position.x - (enemy.position.x + (this.path()[enemy.pathIndex + 1]?.x - enemy.position.x) * enemy.progress);
            const dy = tower.position.y - (enemy.position.y + (this.path()[enemy.pathIndex + 1]?.y - enemy.position.y) * enemy.progress);
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDist) {
                minDist = dist;
                nearest = enemy;
            }
        }
        return nearest;
    }

    private fireAt(tower: Tower, enemy: Enemy) {
        const proj: Projectile = {
            id: crypto.randomUUID(),
            from: { ...tower.position },
            to: { ...enemy.position },
            progress: 0
        };
        this.projectilesInternal.push(proj);

        // Immediate damage for MVP simplicity
        enemy.hp -= tower.damage;
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
                    lastFired: 0
                };
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
        return Math.floor(tower.baseCost * 0.5);
    }

    sellTower(x: number, y: number) {
        this.grid.update(grid => {
            const tile = grid[y][x];
            if (tile.tower) {
                const invested = tile.tower.invested ?? tile.tower.baseCost;
                const refund = Math.floor(invested * 0.5);
                tile.tower = null;
                this.money.update(m => m + refund);
            }
            return [...grid];
        });
    }
}
