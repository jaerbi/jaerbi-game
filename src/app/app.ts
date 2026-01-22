import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from './services/game-engine.service';
import { Unit } from './models/unit.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(public gameEngine: GameEngineService) {}

  onTileClick(x: number, y: number) {
    if (this.gameEngine.gameStatus() !== 'playing') return;

    if (this.gameEngine.buildMode()) {
      this.gameEngine.buildWallAt({ x, y });
      return;
    }

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
}
