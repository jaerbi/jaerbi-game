import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from './services/game-engine.service';
import { SettingsService } from './services/settings.service';
import { Unit } from './models/unit.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  @ViewChild('boardContainer') boardContainer?: ElementRef<HTMLDivElement>;
  constructor(public gameEngine: GameEngineService, public settings: SettingsService) {}
  
  ngAfterViewInit() {
    setTimeout(() => {
      const el: any = this.boardContainer?.nativeElement;
      if (typeof window !== 'undefined' && el && typeof el.scrollTo === 'function') {
        el.scrollTo({ left: 0, top: 0 });
      }
    }, 0);
  }
  
  onMapSizeChange(size: number) {
    this.settings.setMapSize(size as any);
    this.gameEngine.resetGame();
    setTimeout(() => {
      const el: any = this.boardContainer?.nativeElement;
      if (typeof window !== 'undefined' && el && typeof el.scrollTo === 'function') {
        el.scrollTo({ left: 0, top: 0 });
      }
    }, 0);
  }

  onTileClick(x: number, y: number) {
    if (this.gameEngine.gameStatus() !== 'playing') return;

    if (this.gameEngine.isDeployTarget(x, y)) {
      this.gameEngine.deployTo({ x, y });
      return;
    }

    if (x === 0 && y === 0) {
      this.gameEngine.startDeployFromBase();
      return;
    }

    this.gameEngine.cancelDeploy();

    const unit = this.gameEngine.getUnitAt(x, y);

    // If a unit is selected and we click on a valid move tile, move it
    // PRIORITY: Valid Move > New Selection
    if (this.gameEngine.selectedUnit() && this.gameEngine.isValidMove(x, y)) {
      this.gameEngine.moveSelectedUnit({ x, y });
      return;
    }

    // If clicking on a unit owned by player, select it
    if (unit && unit.owner === 'player') {
      this.gameEngine.selectUnit(unit.id);
      return;
    }
    
    // Clicking elsewhere deselects
    this.gameEngine.selectUnit(null);
  }

  onEdgeClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
    event.stopPropagation();
    if (this.gameEngine.gameStatus() !== 'playing') return;
    const wall = this.gameEngine.getWallBetween(x1, y1, x2, y2);
    if (wall) {
      this.gameEngine.attackOrDestroyWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
      return;
    }
    if (this.gameEngine.buildMode()) {
      this.gameEngine.buildWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
    }
  }

  onDestroyIconClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
    event.stopPropagation();
    if (this.gameEngine.gameStatus() !== 'playing') return;
    this.gameEngine.destroyOwnWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
  }

  onBuildIconClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
    event.stopPropagation();
    if (this.gameEngine.gameStatus() !== 'playing') return;
    if (!this.gameEngine.buildMode()) return;
    this.gameEngine.buildWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
  }

  onAttackIconClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
    event.stopPropagation();
    if (this.gameEngine.gameStatus() !== 'playing') return;
    this.gameEngine.attackOrDestroyWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
  }
}
