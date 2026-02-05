import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class MapService {
  generateForests(gridSize: number, playerBase: Position, aiBase: Position): Position[] {
    const total = gridSize * gridSize;
    const count = Math.max(1, Math.floor(total * 0.1));
    const positions: Position[] = [];
    const inSpawnSafeZone = (x: number, y: number) => {
      const dPlayer = Math.max(Math.abs(x - playerBase.x), Math.abs(y - playerBase.y));
      const dAi = Math.max(Math.abs(x - aiBase.x), Math.abs(y - aiBase.y));
      return dPlayer <= 3 || dAi <= 3;
    };
    while (positions.length < count) {
      const x = Math.floor(Math.random() * gridSize);
      const y = Math.floor(Math.random() * gridSize);
      if (inSpawnSafeZone(x, y)) continue;
      if (positions.some(p => p.x === x && p.y === y)) continue;
      positions.push({ x, y });
    }
    return positions;
  }
  generateMines(gridSize: number, playerBase: Position, aiBase: Position, avoid: Position[]): Position[] {
    const avoidSet = new Set(avoid.map(p => `${p.x},${p.y}`));
    const count = gridSize === 10 ? 4 : Math.max(1, Math.floor((gridSize * gridSize) * 0.04));
    const positions: Position[] = [];
    const inSpawnSafeZone = (x: number, y: number) => {
      const dPlayer = Math.max(Math.abs(x - playerBase.x), Math.abs(y - playerBase.y));
      const dAi = Math.max(Math.abs(x - aiBase.x), Math.abs(y - aiBase.y));
      return dPlayer <= 3 || dAi <= 3;
    };
    while (positions.length < count) {
      const x = Math.floor(Math.random() * gridSize);
      const y = Math.floor(Math.random() * gridSize);
      if (inSpawnSafeZone(x, y)) continue;
      const key = `${x},${y}`;
      if (avoidSet.has(key)) continue;
      if (positions.some(p => p.x === x && p.y === y)) continue;
      positions.push({ x, y });
    }
    return positions;
  }

  computeVisibility(gridSize: number, units: Unit[], playerBase: Position, aiBase: Position, fogDebugDisabled: boolean): { player: Set<string>; ai: Set<string> } {
    const res = { player: new Set<string>(), ai: new Set<string>() };
    const inBounds = (x: number, y: number) => x >= 0 && x < gridSize && y >= 0 && y < gridSize;
    const mark = (set: Set<string>, x: number, y: number) => {
      if (inBounds(x, y)) set.add(`${x},${y}`);
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
    if (fogDebugDisabled) {
      for (let x = 0; x < gridSize; x++) {
        for (let y = 0; y < gridSize; y++) {
          res.player.add(`${x},${y}`);
          res.ai.add(`${x},${y}`);
        }
      }
      return res;
    }
    markRadius(res.player, playerBase, 3);
    markRadius(res.ai, aiBase, 3);
    for (const u of units) {
      const set = u.owner === 'player' ? res.player : res.ai;
      markRadius(set, u.position, 2);
    }
    return res;
  }

  mergeExplored(prev: Set<string>, current: Set<string>): Set<string> {
    const next = new Set(prev);
    current.forEach(k => next.add(k));
    return next;
  }
}

