import { Component } from '@angular/core';
import { GameEngineService } from './services/game-engine.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(public gameEngine: GameEngineService) {}

  spawn() {
    this.gameEngine.spawnUnit('player');
  }
}
