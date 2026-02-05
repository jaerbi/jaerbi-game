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
    const hasSupport = units.filter(
      u =>
        u.owner === unit.owner &&
        u.id !== unit.id &&
        u.tier === unit.tier &&
        Math.max(Math.abs(u.position.x - unit.position.x), Math.abs(u.position.y - unit.position.y)) === 1
    );
    if (!!hasSupport.length) {
      bonus += hasSupport.length;
      tags.push(`Support +${hasSupport.length}`);
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
  getWallHitPercent(tier: number): number {
    if (tier === 1) return 34;
    if (tier === 2) return 51;
    return 100;
  }
  getWallHitAmount(tier: number): number {
    if (tier === 1) return 34;
    if (tier === 2) return 51;
    return 101;
  }
  applyDamage(unit: Unit, damage: number): Unit {
    const shield = unit.armorHp ?? 0;
    const shieldLeft = Math.max(0, shield - damage);
    const spill = Math.max(0, damage - shield);
    const nextPoints = Math.max(0, unit.points - spill);
    const { tier, level } = this.calculateTierAndLevel(nextPoints);
    return { ...unit, armorHp: shieldLeft, points: nextPoints, tier, level };
  }
  calculateHitChance(attacker: Unit, defender: Unit): number {
    const gap = defender.tier - attacker.tier;
    const level = attacker.level ?? 1;
    let base = 0;
    if (gap <= 0) base = 100;
    else if (gap === 1) base = Math.min(100, 50 + level * 15);
    else if (gap === 2) base = Math.min(100, 25 + level * 5);
    else base = Math.min(100, 1 + level * 1);
    const weaponBonus = attacker.hasWeapon && defender.tier > attacker.tier ? 10 : 0;
    const armorPenalty = defender.hasArmor ? 10 : 0;
    const final = Math.max(1, Math.min(100, base + weaponBonus - armorPenalty));
    return final;
  }

  isDiagonalBlocked(from: Position, to: Position, getWallBetween: (x1: number, y1: number, x2: number, y2: number) => any): boolean {
    const stepX = Math.sign(to.x - from.x);
    const stepY = Math.sign(to.y - from.y);
    if (stepX === 0 || stepY === 0) return false;
    const w1 = getWallBetween(from.x, from.y, from.x + stepX, from.y);
    const w2 = getWallBetween(from.x, from.y, from.x, from.y + stepY);
    const w3 = getWallBetween(to.x - stepX, to.y, to.x, to.y);
    const w4 = getWallBetween(to.x, to.y - stepY, to.x, to.y);
    return !!(w1 || w2 || w3 || w4);
  }

  checkWallAlongPath(start: Position, target: Position, owner: string, getWallBetween: (x1: number, y1: number, x2: number, y2: number) => any): { hitOwn: boolean; hitEnemy: boolean; lastFrom?: Position } {
    const dxTotal = target.x - start.x;
    const dyTotal = target.y - start.y;
    const stepX = Math.sign(dxTotal);
    const stepY = Math.sign(dyTotal);
    const steps = Math.max(Math.abs(dxTotal), Math.abs(dyTotal));
    for (let i = 1; i <= steps; i++) {
      const from = { x: start.x + stepX * (i - 1), y: start.y + stepY * (i - 1) };
      const to = { x: start.x + stepX * i, y: start.y + stepY * i };
      const wall = getWallBetween(from.x, from.y, to.x, to.y);
      if (wall) {
        if (wall.owner === owner) {
          return { hitOwn: true, hitEnemy: false };
        } else {
          return { hitOwn: false, hitEnemy: true, lastFrom: from };
        }
      }
    }
    return { hitOwn: false, hitEnemy: false };
  }
}
