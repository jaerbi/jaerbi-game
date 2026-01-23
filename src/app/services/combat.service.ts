import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';

@Injectable({ providedIn: 'root' })
export class CombatService {
  calculateTotalPoints(unit: Unit): number {
    return unit.points;
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
  getPointsForTierLevel(tier: number, level: number): number {
    const thresholds: Record<number, number[]> = {
      1: [1, 2, 3, 4],
      2: [5, 10, 15, 20],
      3: [25, 50, 75, 100],
      4: [125, 250, 375, 500]
    };
    const arr = thresholds[tier];
    return arr ? arr[level - 1] : 1;
  }
  getDefenseBonus(unit: Unit, units: Unit[]): { bonus: number; tags: string[] } {
    let bonus = 0;
    const tags: string[] = [];
    if ((unit.turnsStationary ?? 0) >= 3) {
      bonus += 1;
      tags.push('Shield +1');
    }
    const hasSupport = units.some(
      u =>
        u.owner === unit.owner &&
        u.id !== unit.id &&
        u.tier === unit.tier &&
        Math.max(Math.abs(u.position.x - unit.position.x), Math.abs(u.position.y - unit.position.y)) === 1
    );
    if (hasSupport) {
      bonus += 1;
      tags.push('Support +1');
    }
    return { bonus, tags };
  }
  getAttackLuckModifier(unit: Unit): { delta: number; tag?: string; isCrit?: boolean } {
    const roll = Math.random();
    const values: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };
    const delta = values[unit.tier] ?? 0;
    if (roll < 0.2) return { delta, tag: `CRIT! +${delta}`, isCrit: true };
    if (roll > 0.8) return { delta: -delta, tag: `MISS! -${delta}`, isCrit: false };
    return { delta: 0, isCrit: false };
  }
}
