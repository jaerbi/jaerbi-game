import { Injectable } from '@angular/core';
import { Position, Unit, Owner } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class EconomyService {
  getHighestAffordableCost(reserves: number): number {
    const tiers = [500, 375, 250, 125, 100, 75, 50, 25, 20, 15, 10, 5, 4, 3, 2, 1];
    for (const cost of tiers) {
      if (reserves >= cost) return cost;
    }
    return 0;
  }

  computeWoodGain(units: Unit[], owner: Owner): number {
    const countOnForest = units.filter(u => u.owner === owner).filter(u => u.position && u.position.x !== undefined && u.position.y !== undefined).length;
    return countOnForest > 0 ? countOnForest * 2 : 0;
  }

  applyMonopolyTick(prev: { player: number; ai: number }, forests: Position[], units: Unit[]): { next: { player: number; ai: number }, winner?: Owner } {
    const total = forests.length;
    if (total === 0) return { next: { player: 0, ai: 0 } };
    const holds = (owner: Owner) => units.filter(u => u.owner === owner && forests.some(f => f.x === u.position.x && f.y === u.position.y)).length;
    const playerHeld = holds('player');
    const aiHeld = holds('ai');
    const next = { player: prev.player, ai: prev.ai };
    if (playerHeld === total) {
      next.player = prev.player + 1;
      next.ai = 0;
      if (next.player >= 10) return { next, winner: 'player' };
    } else if (aiHeld === total) {
      next.ai = prev.ai + 1;
      next.player = 0;
      if (next.ai >= 10) return { next, winner: 'ai' };
    } else {
      next.player = 0;
      next.ai = 0;
    }
    return { next };
  }

  computeAiReserveDump(gridSize: number, aiBase: Position, reserves: number, getUnitAt: (x: number, y: number) => Unit | null): { created: Unit[], remaining: number } {
    let aiRes = reserves;
    const adj: Position[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = aiBase.x + dx;
        const y = aiBase.y + dy;
        if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
        if (!getUnitAt(x, y)) adj.push({ x, y });
      }
    }
    const created: Unit[] = [];
    while (aiRes > 0 && adj.length > 0) {
      const cost = this.getHighestAffordableCost(aiRes);
      if (cost <= 0) break;
      const tl = this.calculateTierAndLevel(cost);
      const target = adj.shift()!;
      created.push({ id: crypto.randomUUID(), position: { ...target }, level: tl.level, tier: tl.tier, points: cost, owner: 'ai', turnsStationary: 0 });
      aiRes -= cost;
    }
    return { created, remaining: aiRes };
  }

  calculateTierAndLevel(points: number): { tier: number; level: number } {
    const thresholds: Record<number, number[]> = {
      1: [1, 2, 3, 4],
      2: [5, 10, 15, 20],
      3: [25, 50, 75, 100],
      4: [125, 250, 375, 500]
    };
    if (points <= 0) return { tier: 1, level: 1 };
    for (let t = 4; t >= 1; t--) {
      const arr = thresholds[t];
      for (let l = arr.length; l >= 1; l--) {
        if (points >= arr[l - 1]) {
          return { tier: t, level: l };
        }
      }
    }
    return { tier: 1, level: 1 };
  }
}

