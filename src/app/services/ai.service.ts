import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';
import { CombatService } from './combat.service';
import { BuildService } from './build.service';

@Injectable({ providedIn: 'root' })
export class AIService {
  constructor(private combat: CombatService, private build: BuildService) {}
  performTurn(engine: any) {
    if (engine.gameStatus() !== 'playing') return;
    if (!engine.wallBuiltThisTurn()) {
      const aiBase = engine.getBasePosition('ai');
      const candidates = engine.units().filter((u: Unit) => u.owner === 'player')
        .filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3)
        .sort((a: Unit, b: Unit) => this.combat.calculateTotalPoints(b) - this.combat.calculateTotalPoints(a));
      for (const enemy of candidates) {
        const dx = Math.sign(aiBase.x - enemy.position.x);
        const dy = Math.sign(aiBase.y - enemy.position.y);
        const edges: Position[] = [];
        if (dx !== 0) edges.push({ x: enemy.position.x + dx, y: enemy.position.y });
        if (dy !== 0) edges.push({ x: enemy.position.x, y: enemy.position.y + dy });
        for (const e of edges) {
          const a = enemy.position;
          const b = e;
          if (engine.canBuildWallBetween(a, b)) {
            engine.aiBuildWallBetween(a, b);
            break;
          }
        }
        if (engine.wallBuiltThisTurn()) break;
      }
    }
    engine.performAiDeployment();
    engine.performAiMovement();
  }
}
