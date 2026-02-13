import { Injectable, signal, computed } from '@angular/core';

export interface Position {
  x: number;
  y: number;
}

export type TileType = 'path' | 'buildable' | 'void';

export interface Tower {
  id: string;
  type: number; // Tier 1-4
  level: number; // Level 1-4
  position: Position;
  damage: number;
  range: number;
  lastFired: number;
}

export interface Enemy {
  id: string;
  position: Position;
  pathIndex: number;
  hp: number;
  maxHp: number;
  speed: number;
  progress: number; // For smooth animation between path tiles
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
  
  gridSize = 10;
  grid = signal<TDTile[][]>([]);
  path = signal<Position[]>([]);
  
  enemies = signal<Enemy[]>([]);
  projectiles = signal<Projectile[]>([]);
  
  // Costs and Stats
  towerCosts = [10, 25, 60, 150];
  upgradeCosts = [15, 40, 100];
  
  constructor() {
    this.initGame();
  }

  initGame() {
    this.money.set(100);
    this.lives.set(20);
    this.wave.set(0);
    this.enemies.set([]);
    this.projectiles.set([]);
    this.generateMap();
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
            {x: x-1, y}, {x: x+1, y}, {x, y: y-1}, {x, y: y+1}
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
    if (this.isWaveInProgress()) return;
    this.wave.update(w => w + 1);
    this.isWaveInProgress.set(true);
    this.spawnWave();
  }

  private spawnWave() {
    const enemyCount = 5 + this.wave() * 2;
    const hp = 10 + Math.pow(this.wave(), 1.5) * 5;
    
    let spawned = 0;
    const interval = setInterval(() => {
      if (spawned >= enemyCount) {
        clearInterval(interval);
        return;
      }
      
      const newEnemy: Enemy = {
        id: crypto.randomUUID(),
        position: { ...this.path()[0] },
        pathIndex: 0,
        hp: hp,
        maxHp: hp,
        speed: 0.05 + (this.wave() * 0.005),
        progress: 0
      };
      
      this.enemies.update(e => [...e, newEnemy]);
      spawned++;
    }, 1000);

    // Main game loop for this wave
    const gameLoop = setInterval(() => {
      this.updateGame();
      if (!this.isWaveInProgress() && this.enemies().length === 0) {
        clearInterval(gameLoop);
      }
    }, 50);
  }

  updateGame() {
    this.updateEnemies();
    this.updateTowers();
    this.updateProjectiles();
    
    if (this.enemies().length === 0 && this.isWaveInProgress()) {
      // Check if more are spawning
      // For now simple:
      this.isWaveInProgress.set(false);
    }
  }

  private updateEnemies() {
    this.enemies.update(enemies => {
      const remaining: Enemy[] = [];
      for (const enemy of enemies) {
        enemy.progress += enemy.speed;
        
        if (enemy.progress >= 1) {
          enemy.pathIndex++;
          enemy.progress = 0;
          
          if (enemy.pathIndex >= this.path().length - 1) {
            // Reached base
            this.lives.update(l => Math.max(0, l - 1));
            continue; 
          }
          
          enemy.position = { ...this.path()[enemy.pathIndex] };
        }
        
        if (enemy.hp > 0) {
          remaining.push(enemy);
        } else {
          this.money.update(m => m + 5 + this.wave());
        }
      }
      return remaining;
    });
  }

  private updateTowers() {
    const now = Date.now();
    const currentEnemies = this.enemies();
    if (currentEnemies.length === 0) return;

    this.grid.update(grid => {
      for (const row of grid) {
        for (const tile of row) {
          if (tile.tower) {
            const tower = tile.tower;
            if (now - tower.lastFired > 1000 / tower.level) {
              // Find nearest enemy in range
              const target = this.findNearestEnemy(tower, currentEnemies);
              if (target) {
                this.fireAt(tower, target);
                tower.lastFired = now;
              }
            }
          }
        }
      }
      return [...grid];
    });
  }

  private findNearestEnemy(tower: Tower, enemies: Enemy[]): Enemy | null {
    let nearest: Enemy | null = null;
    let minDist = tower.range;
    
    for (const enemy of enemies) {
      const dx = tower.position.x - (enemy.position.x + (this.path()[enemy.pathIndex+1]?.x - enemy.position.x) * enemy.progress);
      const dy = tower.position.y - (enemy.position.y + (this.path()[enemy.pathIndex+1]?.y - enemy.position.y) * enemy.progress);
      const dist = Math.sqrt(dx*dx + dy*dy);
      
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
      to: { ...enemy.position }, // This is simplified, should track enemy
      progress: 0
    };
    this.projectiles.update(p => [...p, proj]);
    
    // Immediate damage for MVP simplicity
    enemy.hp -= tower.damage;
  }

  private updateProjectiles() {
    this.projectiles.update(projs => {
      return projs.map(p => ({ ...p, progress: p.progress + 0.2 })).filter(p => p.progress < 1);
    });
  }

  buyTower(x: number, y: number, tier: number) {
    const cost = this.towerCosts[tier - 1];
    if (this.money() < cost) return;
    
    this.grid.update(grid => {
      const tile = grid[y][x];
      if (tile.type === 'buildable' && !tile.tower) {
        tile.tower = {
          id: crypto.randomUUID(),
          type: tier,
          level: 1,
          position: { x, y },
          damage: tier * 5,
          range: 2.5 + tier * 0.5,
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
        const cost = this.upgradeCosts[tile.tower.level - 1];
        if (this.money() >= cost) {
          tile.tower.level++;
          tile.tower.damage += 5;
          tile.tower.range += 0.5;
          this.money.update(m => m - cost);
        }
      }
      return [...grid];
    });
  }
}
