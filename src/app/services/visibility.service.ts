import { Injectable, signal } from '@angular/core';
import { Position, Unit } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class VisibilityService {
  recompute(gridSize: number, playerBase: Position, aiBase: Position, units: Unit[]): { player: Set<string>; ai: Set<string> } {
    const playerSet = new Set<string>();
    const aiSet = new Set<string>();
    const mark = (set: Set<string>, x: number, y: number) => {
      if (x >= 0 && x < gridSize && y >= 0 && y < gridSize) set.add(`${x},${y}`);
    };
    const markRadius = (set: Set<string>, center: Position, radius: number) => {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          const x = center.x + dx;
          const y = center.y + dy;
          if (Math.max(Math.abs(dx), Math.abs(dy)) <= radius) mark(set, x, y);
        }
      }
    };
    markRadius(playerSet, playerBase, 3);
    markRadius(aiSet, aiBase, 3);
    for (const u of units) {
      const set = u.owner === 'player' ? playerSet : aiSet;
      markRadius(set, u.position, 2);
    }
    return { player: playerSet, ai: aiSet };
  }
}
