import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TowerDefenseEngineService, TDTile } from '../../services/tower-defense-engine.service';
import { UnitsComponent } from '../units/units.component';
import { Unit } from '../../models/unit.model';

@Component({
  selector: 'app-tower-defense',
  standalone: true,
  imports: [CommonModule, UnitsComponent],
  templateUrl: 'tower-defense.component.html',
  styleUrls: ['../../app.css'],
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background: #0f172a;
      color: white;
    }
    .td-grid {
      display: grid;
      grid-template-columns: repeat(10, 60px);
      grid-template-rows: repeat(10, 60px);
      gap: 2px;
      background: #1e293b;
      border: 4px solid #334155;
      border-radius: 8px;
      position: relative;
    }
    .td-tile {
      position: relative;
      width: 60px;
      height: 60px;
      transition: all 0.2s;
      overflow: hidden;
    }
    .tile-path { background: #475569; }
    .tile-buildable { 
      background: #1e293b; 
      cursor: pointer;
    }
    .tile-buildable:hover { background: #334155; }
    .tile-void { opacity: 0.1; }
    
    .range-indicator {
      position: absolute;
      background: rgba(56, 189, 248, 0.15);
      border: 2px solid rgba(56, 189, 248, 0.5);
      border-radius: 50%;
      pointer-events: none;
      z-index: 5;
      transform: translate(-50%, -50%);
      transition: all 0.2s ease-out;
    }

    .enemy {
      position: absolute;
      width: 40px;
      height: 40px;
      background: #ef4444;
      border-radius: 50%;
      z-index: 10;
      box-shadow: 0 0 10px #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .projectile {
      position: absolute;
      width: 6px;
      height: 6px;
      background: #fbbf24;
      border-radius: 50%;
      z-index: 20;
      box-shadow: 0 0 5px #fbbf24;
    }

    .shop-btn {
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      font-weight: 700;
      transition: all 0.2s;
    }
    .shop-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `]
})
export class TowerDefenseComponent implements OnDestroy {
  selectedTile = signal<TDTile | null>(null);

  constructor(
    public tdEngine: TowerDefenseEngineService,
    private router: Router
  ) {}

  ngOnDestroy() {
    this.tdEngine.stopGameLoop();
  }

  goBack() {
    this.tdEngine.stopGameLoop();
    this.router.navigate(['/']);
  }

  onRestart() {
    this.tdEngine.resetGame();
    this.selectedTile.set(null);
  }

  onTileClick(tile: TDTile) {
    if (tile.type === 'buildable' || tile.tower) {
      this.selectedTile.set(tile);
    } else {
      this.selectedTile.set(null);
    }
  }

  buyTower(tier: number) {
    const tile = this.selectedTile();
    if (tile) {
      this.tdEngine.buyTower(tile.x, tile.y, tier);
      this.selectedTile.set(null);
    }
  }

  upgradeTower() {
    const tile = this.selectedTile();
    if (tile && tile.tower) {
      this.tdEngine.upgradeTower(tile.x, tile.y);
    }
  }

  // Helper to convert Tower to Unit for UnitsComponent
  asUnit(tower: any): Unit {
    return {
      ...tower,
      owner: 'player',
      points: 0, // Not used by SVG
      turnsStationary: 0,
      tier: tower.type
    } as Unit;
  }

  getEnemyStyle(enemy: any) {
    const path = this.tdEngine.path();
    const current = path[enemy.pathIndex];
    const next = path[enemy.pathIndex + 1] || current;
    
    const x = current.x + (next.x - current.x) * enemy.progress;
    const y = current.y + (next.y - current.y) * enemy.progress;
    
    // Cell size is 60px, gap is 2px. 
    // center of cell is (x * 62 + 30)
    return {
      left: `${x * 62 + 10}px`,
      top: `${y * 62 + 10}px`
    };
  }

  getProjectileStyle(p: any) {
    const x = p.from.x + (p.to.x - p.from.x) * p.progress;
    const y = p.from.y + (p.to.y - p.from.y) * p.progress;
    return {
      left: `${x * 62 + 28}px`,
      top: `${y * 62 + 28}px`
    };
  }

  getRangeStyle() {
    const tile = this.selectedTile();
    if (!tile || !tile.tower) return { display: 'none' };
    
    const tower = tile.tower;
    const size = tower.range * 2 * 62; // range is in tiles
    return {
      left: `${tower.position.x * 62 + 30}px`,
      top: `${tower.position.y * 62 + 30}px`,
      width: `${size}px`,
      height: `${size}px`,
      display: 'block'
    };
  }
}
