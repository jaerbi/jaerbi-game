import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class BuildService {
  areAdjacent(a: Position, b: Position): boolean {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }
  sortEdgeEndpoints(a: Position, b: Position): [Position, Position] {
    if (a.x < b.x || (a.x === b.x && a.y <= b.y)) return [a, b];
    return [b, a];
  }
  isInNoBuildZone(tile: Position, playerBase: Position, aiBase: Position): boolean {
    const bases = [playerBase, aiBase];
    for (const base of bases) {
      const dx = Math.abs(tile.x - base.x);
      const dy = Math.abs(tile.y - base.y);
      if (Math.max(dx, dy) <= 2) return true;
    }
    return false;
  }
  isAnyUnitAdjacentToEdge(units: Unit[], owner: 'player' | 'ai', tile1: Position, tile2: Position): boolean {
    return units.some(
      u =>
        u.owner === owner &&
        ((u.position.x === tile1.x && u.position.y === tile1.y) || (u.position.x === tile2.x && u.position.y === tile2.y))
    );
  }
}
