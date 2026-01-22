import { Component } from '@angular/core';
import { GameEngineService } from './services/game-engine.service';
import { Unit } from './models/unit.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(public gameEngine: GameEngineService) {}

  onTileClick(x: number, y: number) {
    const unit = this.gameEngine.getUnitAt(x, y);

    // If clicking on a unit owned by player, select it
    if (unit && unit.owner === 'player') {
      this.gameEngine.selectUnit(unit.id);
      return;
    }

    // If a unit is selected and we click on a valid move tile, move it
    if (this.gameEngine.selectedUnit() && this.gameEngine.isValidMove(x, y)) {
      this.gameEngine.moveSelectedUnit({ x, y });
      return;
    }
    
    // Clicking elsewhere deselects (optional, but good UX)
    this.gameEngine.selectUnit(null);
  }
}
