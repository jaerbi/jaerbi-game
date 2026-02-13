import { Component, signal } from '@angular/core';
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
  styleUrls: ['../../app.css',],
  styles: [`
    :host {
      display: block;
      height: 100vh;
      background: #0f172a;
      color: white;
    }
    .td-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 2px;
      aspect-ratio: 1;
      background: #1e293b;
      border: 4px solid #334155;
      border-radius: 8px;
    }
    .td-tile {
      position: relative;
      width: 100%;
      height: 100%;
      transition: all 0.2s;
    }
    .tile-path { background: #475569; }
    .tile-buildable { 
      background: #1e293b; 
      cursor: pointer;
    }
    .tile-buildable:hover { background: #334155; }
    .tile-void { opacity: 0.1; }
    
    .enemy {
      position: absolute;
      width: 60%;
      height: 60%;
      background: #ef4444;
      border-radius: 50%;
      top: 20%;
      left: 20%;
      z-index: 10;
      box-shadow: 0 0 10px #ef4444;
      transition: all 0.05s linear;
    }
    
    .projectile {
      position: absolute;
      width: 4px;
      height: 4px;
      background: #fbbf24;
      border-radius: 50%;
      z-index: 20;
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
export class TowerDefenseComponent {
  selectedTile = signal<TDTile | null>(null);

  constructor(
    public tdEngine: TowerDefenseEngineService,
    private router: Router
  ) {}

  goBack() {
    this.router.navigate(['/']);
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
    
    return {
      left: `${x * 10}%`,
      top: `${y * 10}%`,
      width: '10%',
      height: '10%'
    };
  }

  getProjectileStyle(p: any) {
    const x = p.from.x + (p.to.x - p.from.x) * p.progress;
    const y = p.from.y + (p.to.y - p.from.y) * p.progress;
    return {
      left: `${x * 10 + 4}%`,
      top: `${y * 10 + 4}%`
    };
  }
}
