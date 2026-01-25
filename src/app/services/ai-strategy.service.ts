import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';
import { CombatService } from './combat.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class AiStrategyService {
  constructor(private combat: CombatService, private settings: SettingsService) {}
  private goals = new Map<string, Position>();

  pickBestMove(engine: any): { unit: Unit; target: Position; reason: string } | null {
    const d = this.chooseBestEndingAction(engine);
    if (!d) return null;
    if (d.type === 'move' || d.type === 'attack') return { unit: d.unit, target: d.target, reason: d.reason };
    return null;
  }

  chooseBestEndingAction(engine: any): { type: 'move' | 'attack' | 'merge'; unit: Unit; target: Position; reason: string } | null {
    const alreadyMoved: Set<string> = new Set(engine.movedThisTurnSignal?.() ?? []);
    const aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && !alreadyMoved.has(u.id));
    if (aiUnits.length === 0) return null;
    const aiBase: Position = engine.getBasePosition('ai');
    const forests: Position[] = engine.forestsSignal();
    const unoccupied = forests.filter(f => !engine.getUnitAt(f.x, f.y));
    const visibleFree = unoccupied.filter(f => engine.isVisibleToAi(f.x, f.y));
    const fogForests = forests.filter(f => !engine.isVisibleToAi(f.x, f.y));
    const reconNeeded = visibleFree.length === 0;
    const aiForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && engine.isForest(u.position.x, u.position.y)).length;
    const enemyNearBase = engine.unitsSignal().some((u: Unit) => u.owner === 'player' && Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3);
    let best: { unit: Unit; target: Position; score: number; type: 'move' | 'attack' | 'merge'; reason: string } | null = null;
    const clusterCount = aiUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3).length;
    const center = { x: Math.floor(engine.gridSize / 2), y: Math.floor(engine.gridSize / 2) };
    const timeMap: Map<string, number> = new Map(engine.aiUnitTimeNearBase());
    for (const unit of aiUnits) {
      const moves: Position[] = engine.calculateValidMoves(unit);
      const nearBase = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y)) <= 3;
      const stagnantTurns = (timeMap.get(unit.id) || 0);
      const stagnant = stagnantTurns > 2;
      let goal: Position | null = this.goals.get(unit.id) || null;
      const hasGoal = goal !== null;
      const goalOccupiedByStrongerAlly = hasGoal ? (() => {
        const gUnit = engine.getUnitAt(goal!.x, goal!.y);
        return !!(gUnit && gUnit.owner === 'ai' && this.combat.calculateTotalPoints(gUnit) >= this.combat.calculateTotalPoints(unit));
      })() : false;
      const needNewGoal = !hasGoal || goalOccupiedByStrongerAlly;
      if (needNewGoal) {
        if (visibleFree.length > 0) {
          goal = visibleFree.reduce((acc, f) => {
            const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
            return d < (Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y)) ? f : acc;
          }, visibleFree[0]);
        } else if (fogForests.length > 0) {
          goal = fogForests.reduce((acc, f) => {
            const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
            return d < (Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y)) ? f : acc;
          }, fogForests[0]);
        } else {
          goal = { x: 0, y: 0 };
        }
        this.goals.set(unit.id, goal!);
      }
      const forceCenter = clusterCount > 3 && stagnantTurns >= 5;
      if (forceCenter) {
        goal = center;
      }
      for (const move of moves) {
        let score = 0;
        let reason = 'Action';
        const targetUnit = engine.getUnitAt(move.x, move.y);
        const baseDistCurr = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y));
        const baseDistMove = Math.max(Math.abs(move.x - aiBase.x), Math.abs(move.y - aiBase.y));
        const nearestVisibleCurrent = visibleFree.length ? Math.min(...visibleFree.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
        const nearestVisibleMove = visibleFree.length ? Math.min(...visibleFree.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
        const nearestFogCurrent = fogForests.length ? Math.min(...fogForests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
        const nearestFogMove = fogForests.length ? Math.min(...fogForests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
        const nearestForestCurrent = forests.length ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
        const nearestForestMove = forests.length ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
        const histMap = new Map(engine.unitMoveHistorySignal());
        const histRaw = histMap.get(unit.id);
        const hist: Position[] = Array.isArray(histRaw) ? (histRaw as Position[]) : [];
        const prevTile = hist.length >= 2 ? hist[hist.length - 2] : null;
        const returning = prevTile && move.x === prevTile.x && move.y === prevTile.y;
        if (!targetUnit) {
          if (engine.isForest(move.x, move.y) && !engine.getUnitAt(move.x, move.y)) {
            score = 1000000;
            reason = aiForestCount < 3 ? `Priority 0: Capture Forest ${move.x},${move.y}` : `Priority 1: Capture Forest ${move.x},${move.y}`;
          }
          if (goal) {
            const dCurr = Math.abs(unit.position.x - goal.x) + Math.abs(unit.position.y - goal.y);
            const dMove = Math.abs(move.x - goal.x) + Math.abs(move.y - goal.y);
            if (dMove < dCurr) {
              score += 50000 * (dCurr - dMove);
              reason = visibleFree.length > 0 ? `Priority 1: Toward Forest ${goal.x},${goal.y}` : (fogForests.length > 0 ? `Priority 7: Toward Fog Forest ${goal.x},${goal.y}` : `Toward Goal ${goal.x},${goal.y}`);
            }
          }
          if (nearBase && nearestForestMove < nearestForestCurrent) {
            score *= 10;
          }
          if (baseDistMove > baseDistCurr && nearestForestMove < nearestForestCurrent) {
            score += 500;
          }
          if (returning) {
            score = Math.floor(score * 0.1);
          }
        } else {
          if (targetUnit.owner === 'player') {
            const myPower = this.combat.calculateTotalPoints(unit);
            const enemyPower = this.combat.calculateTotalPoints(targetUnit);
            if (myPower >= enemyPower) {
              score = 3000 + enemyPower * 50;
              reason = 'Attack Enemy';
              if (enemyNearBase) score += 5000;
            }
          } else {
            if (targetUnit.tier === unit.tier && baseDistMove > baseDistCurr) {
              const mergedPoints = this.combat.calculateTotalPoints(unit) + this.combat.calculateTotalPoints(targetUnit);
              const { tier } = this.combat.calculateTierAndLevel(mergedPoints);
              if (tier > unit.tier && !nearBase) {
                score = 1000;
                reason = 'Merge Up';
              }
            }
          }
        }
        let type: 'move' | 'attack' | 'merge' = 'move';
        if (targetUnit && targetUnit.owner === 'player') type = 'attack';
        if (targetUnit && targetUnit.owner === 'ai' && targetUnit.tier === unit.tier) type = 'merge';
        if (best === null || score > best.score) {
          best = { unit, target: move, score, type, reason };
        }
      }
    }
    if (!best) return null;
    const goal = this.goals.get(best.unit.id);
    const goalText = goal ? `Goal: Forest at ${goal.x},${goal.y}` : 'Goal: None';
    console.log(`[AI Decision] Unit ${best.unit.id} moving to (${best.target.x},${best.target.y}) targeting ${goalText}.`);
    return { type: best.type, unit: best.unit, target: best.target, reason: best.reason };
  }

  getWallBuildActions(engine: any): { from: Position; to: Position }[] {
    const actions: { from: Position; to: Position }[] = [];
    const aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai');
    const playerUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
    const walls = engine.wallsSignal();

    // Helper to check if wall exists
    const hasWall = (p1: Position, p2: Position) => walls.some((w: any) => 
      (w.tile1.x === p1.x && w.tile1.y === p1.y && w.tile2.x === p2.x && w.tile2.y === p2.y) ||
      (w.tile1.x === p2.x && w.tile1.y === p2.y && w.tile2.x === p1.x && w.tile2.y === p1.y)
    );
    // Helper to check distance (Manhattan)
    const dist = (p1: Position, p2: Position) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
    // Helper to check Chebyshev distance (for "within 2 cells")
    const maxDist = (p1: Position, p2: Position) => Math.max(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));

    for (const unit of aiUnits) {
      // Rule 6: Level 3+ prohibited from building walls
      if (unit.tier >= 3) continue;

      // Check for nearby enemies (within 2 cells)
      const nearbyEnemies = playerUnits.filter((p: Unit) => maxDist(unit.position, p.position) <= 2);
      if (nearbyEnemies.length === 0) continue;

      const closestEnemy = nearbyEnemies.sort((a: Unit, b: Unit) => dist(unit.position, a.position) - dist(unit.position, b.position))[0];

      // Directions
      const neighbors = [
        { x: unit.position.x + 1, y: unit.position.y },
        { x: unit.position.x - 1, y: unit.position.y },
        { x: unit.position.x, y: unit.position.y + 1 },
        { x: unit.position.x, y: unit.position.y - 1 }
      ].filter(p => engine.inBounds(p.x, p.y));

      // Determine "attacker's side" by sorting neighbors by distance to enemy
      const sortedNeighbors = neighbors.sort((a, b) => dist(a, closestEnemy.position) - dist(b, closestEnemy.position));

      // Level 1 on Forest: Build walls on all 4 sides
      if (unit.tier === 1 && engine.isForest(unit.position.x, unit.position.y)) {
        for (const n of sortedNeighbors) {
           if (!hasWall(unit.position, n) && engine.canBuildWallBetween(unit.position, n)) {
             actions.push({ from: unit.position, to: n });
           }
        }
      } 
      // Level 2: Build max 2 walls on attacker's side
      else if (unit.tier === 2) {
        let count = 0;
        for (const n of sortedNeighbors) {
          if (count >= 2) break;
           if (!hasWall(unit.position, n) && engine.canBuildWallBetween(unit.position, n)) {
             actions.push({ from: unit.position, to: n });
             count++;
           }
        }
      }
    }
    return actions;
  }
}
