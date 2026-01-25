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
    const aiForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && engine.isForest(u.position.x, u.position.y)).length;
    const playerUnits: Unit[] = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
    const enemyNearBase = playerUnits.some((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3);
    const baseThreatEnemies = playerUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 2);
    const baseThreat = baseThreatEnemies.length > 0;
    const baseProximity = playerUnits.some((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 5);
    const aggression = typeof engine.aggressionMode === 'function' ? !!engine.aggressionMode() : (playerUnits.filter((p: Unit) => engine.isForest(p.position.x, p.position.y)).length * 2) >= (aiUnits.filter((a: Unit) => engine.isForest(a.position.x, a.position.y)).length * 2);
    let best: { unit: Unit; target: Position; score: number; type: 'move' | 'attack' | 'merge'; reason: string } | null = null;
    const clusterCount = aiUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3).length;
    const center = { x: Math.floor(engine.gridSize / 2), y: Math.floor(engine.gridSize / 2) };
    const timeMap: Map<string, number> = new Map(engine.aiUnitTimeNearBase());
    for (const unit of aiUnits) {
      const moves: Position[] = engine.calculateValidMoves(unit);
      const nearBase = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y)) <= 3;
      const stagnantTurns = (timeMap.get(unit.id) || 0);
      let goal: Position | null = this.goals.get(unit.id) || null;
      const hasGoal = goal !== null;
      const goalOccupiedByStrongerAlly = hasGoal ? (() => {
        const gUnit = engine.getUnitAt(goal!.x, goal!.y);
        return !!(gUnit && gUnit.owner === 'ai' && this.combat.calculateTotalPoints(gUnit) >= this.combat.calculateTotalPoints(unit));
      })() : false;
      const needNewGoal = (!hasGoal || goalOccupiedByStrongerAlly) && (!engine.isForest(unit.position.x, unit.position.y) || baseProximity || unit.tier >= 3);
      if (needNewGoal) {
        const enemyOnForest = playerUnits.filter(p => engine.isForest(p.position.x, p.position.y));
        if (aggression && enemyOnForest.length > 0) {
          const nearestEF = enemyOnForest.reduce((acc, e) => {
            const d = Math.abs(unit.position.x - e.position.x) + Math.abs(unit.position.y - e.position.y);
            const da = Math.abs(unit.position.x - acc.position.x) + Math.abs(unit.position.y - acc.position.y);
            return d < da ? e : acc;
          }, enemyOnForest[0]);
          goal = { x: nearestEF.position.x, y: nearestEF.position.y };
        } else {
          const nearestEnemy = (() => {
            if (playerUnits.length === 0) return null;
            const sorted = [...playerUnits].sort((a, b) => {
              const da = Math.abs(unit.position.x - a.position.x) + Math.abs(unit.position.y - a.position.y);
              const db = Math.abs(unit.position.x - b.position.x) + Math.abs(unit.position.y - b.position.y);
              return da - db;
            });
            return sorted[0];
          })();
          if (nearestEnemy) {
            goal = { x: nearestEnemy.position.x, y: nearestEnemy.position.y };
          } else if (visibleFree.length > 0) {
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
        }
        this.goals.set(unit.id, goal!);
      }
      const forceCenter = clusterCount > 3 && stagnantTurns >= 5;
      if (forceCenter) {
        goal = center;
      }
      const isOnForest = engine.isForest(unit.position.x, unit.position.y);
      const inSession = isOnForest && (unit.forestOccupationTurns ?? 0) > 0 && !(unit.productionActive ?? false);
      const lowTierNearby = engine.unitsSignal().some((u2: Unit) =>
        u2.owner === 'ai' && u2.id !== unit.id && u2.tier <= 2 &&
        Math.max(Math.abs(u2.position.x - unit.position.x), Math.abs(u2.position.y - unit.position.y)) <= 3
      );
      if (inSession && !baseProximity && unit.tier < 3) {
        this.goals.set(unit.id, { x: unit.position.x, y: unit.position.y });
        console.log(`[AI Block] Unit ${unit.id} is blocked in the forest at (${unit.position.x},${unit.position.y}). Progress: ${(unit.forestOccupationTurns ?? 0)}/3.`);
        continue;
      }
      if (unit.tier >= 3 && isOnForest && (lowTierNearby || baseProximity)) {
        // Handover: abandon forest to lower tier or leave if base threatened
        this.goals.set(unit.id, { x: aiBase.x, y: aiBase.y });
      }
      if (goal) {
        const enemyAtGoal = engine.getUnitAt(goal.x, goal.y);
        if (enemyAtGoal && enemyAtGoal.owner === 'player' && engine.isForest(goal.x, goal.y)) {
          const gx = goal.x;
          const gy = goal.y;
          const canAttack = moves.some(m => m.x === gx && m.y === gy);
          if (canAttack) {
            const score = 300000;
            const reason = 'Attack Enemy on Forest';
            if (best === null || score > best.score) {
              best = { unit, target: { x: gx, y: gy }, score, type: 'attack', reason };
            }
            continue;
          } else {
            const candidates = visibleFree.length > 0 ? visibleFree : fogForests;
            if (candidates.length > 0) {
              const nearest = candidates.reduce((acc, f) => {
                const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
                return d < da ? f : acc;
              }, candidates[0]);
              goal = nearest;
              this.goals.set(unit.id, goal);
            } else {
              continue;
            }
          }
        }
      }
      const adjacentEnemies = playerUnits.filter(p => Math.max(Math.abs(p.position.x - unit.position.x), Math.abs(p.position.y - unit.position.y)) === 1);
      const strongestAdjEnemy = adjacentEnemies.length > 0 ? adjacentEnemies.reduce((acc, e) => (this.combat.calculateTotalPoints(e) > this.combat.calculateTotalPoints(acc) ? e : acc), adjacentEnemies[0]) : null;
      for (const move of moves) {
        let score = 0;
        let reason = 'Action';
        const targetUnit = engine.getUnitAt(move.x, move.y);
        const baseDistCurr = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y));
        const baseDistMove = Math.max(Math.abs(move.x - aiBase.x), Math.abs(move.y - aiBase.y));
        const nearestForestCurrent = forests.length ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
        const nearestForestMove = forests.length ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
        const histMap = new Map(engine.unitMoveHistorySignal());
        const histRaw = histMap.get(unit.id);
        const hist: Position[] = Array.isArray(histRaw) ? (histRaw as Position[]) : [];
        const prevTile = hist.length >= 2 ? hist[hist.length - 2] : null;
        const returning = prevTile && move.x === prevTile.x && move.y === prevTile.y;
        const leavingForest = isOnForest && !(engine.isForest(move.x, move.y));
        if (isOnForest && adjacentEnemies.length === 0 && !targetUnit && leavingForest) {
          score = -1000;
        }
        if (!targetUnit) {
          if (engine.isForest(move.x, move.y) && !engine.getUnitAt(move.x, move.y)) {
            if (unit.tier >= 3) {
              const lowTierWithin3 = engine.unitsSignal().some((u2: Unit) =>
                u2.owner === 'ai' && u2.tier <= 2 &&
                Math.max(Math.abs(u2.position.x - move.x), Math.abs(u2.position.y - move.y)) <= 3
              );
              const enemiesVisibleNear = playerUnits.some((p: Unit) =>
                Math.max(Math.abs(p.position.x - unit.position.x), Math.abs(p.position.y - unit.position.y)) <= 2 &&
                engine.isVisibleToAi(p.position.x, p.position.y)
              );
              if (!lowTierWithin3 && !enemiesVisibleNear) {
                score = 500000;
                reason = 'Early Flex: T3 capture forest';
              } else {
                score = -1;
                reason = 'Hunter: Avoid Forest';
              }
            } else {
              score = 1000000;
              reason = aiForestCount < 3 ? `Priority 0: Capture Forest ${move.x},${move.y}` : `Priority 1: Capture Forest ${move.x},${move.y}`;
            }
          }
          if (goal) {
            const dCurr = Math.abs(unit.position.x - goal.x) + Math.abs(unit.position.y - goal.y);
            const dMove = Math.abs(move.x - goal.x) + Math.abs(move.y - goal.y);
            if (dMove < dCurr) {
              score += 50000 * (dCurr - dMove);
              reason = visibleFree.length > 0 ? `Priority 1: Toward Forest ${goal.x},${goal.y}` : (fogForests.length > 0 ? `Priority 7: Toward Fog Forest ${goal.x},${goal.y}` : `Toward Goal ${goal.x},${goal.y}`);
            }
          }
          // Base attack override: if move hits player base, supersede priorities
          const playerBase = engine.getBasePosition('player');
          if (move.x === playerBase.x && move.y === playerBase.y) {
            score += 10000;
            reason = 'Attack Base (Override)';
          }
          if (baseThreat) {
            const nearest = baseThreatEnemies.reduce((acc, e) => {
              const d = Math.abs(unit.position.x - e.position.x) + Math.abs(unit.position.y - e.position.y);
              const da = Math.abs(unit.position.x - acc.position.x) + Math.abs(unit.position.y - acc.position.y);
              return d < da ? e : acc;
            }, baseThreatEnemies[0]);
            const dCurr = Math.abs(unit.position.x - nearest.position.x) + Math.abs(unit.position.y - nearest.position.y);
            const dMove = Math.abs(move.x - nearest.position.x) + Math.abs(move.y - nearest.position.y);
            if (dMove < dCurr) {
              score += 5000 * (dCurr - dMove);
              if (unit.tier >= 3) score += 4000;
              reason = 'Defense 1: Intercept Threat';
            }
          }
          if (unit.tier >= 3) {
            const bCurr = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
            const bMove = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
            if (bMove < bCurr) {
              score += 2000 * (bCurr - bMove);
              reason = 'Hunter: Toward Base';
            }
          }
          if (nearBase && nearestForestMove < nearestForestCurrent) {
            score *= 10;
          }
          if (baseDistMove > baseDistCurr && nearestForestMove < nearestForestCurrent) {
            score += 500;
          }
          if (strongestAdjEnemy && this.combat.calculateTotalPoints(strongestAdjEnemy) > this.combat.calculateTotalPoints(unit)) {
            const dCurrSE = Math.abs(unit.position.x - strongestAdjEnemy.position.x) + Math.abs(unit.position.y - strongestAdjEnemy.position.y);
            const dMoveSE = Math.abs(move.x - strongestAdjEnemy.position.x) + Math.abs(move.y - strongestAdjEnemy.position.y);
            if (dMoveSE > dCurrSE) {
              score += 75000 * (dMoveSE - dCurrSE);
              reason = 'Retreat';
            }
          }
        } else {
          if (targetUnit.owner === 'player') {
            const myPower = this.combat.calculateTotalPoints(unit);
            const enemyPower = this.combat.calculateTotalPoints(targetUnit);
            const alliesNearTarget = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && u.id !== unit.id && Math.max(Math.abs(u.position.x - move.x), Math.abs(u.position.y - move.y)) === 1).length;
            if (myPower >= enemyPower || (aggression && unit.tier >= targetUnit.tier) || (myPower < enemyPower && alliesNearTarget >= 2)) {
              score = 200000;
              reason = (aggression && unit.tier >= targetUnit.tier) ? `Attack (Wood War / Equal Tier)` : (myPower < enemyPower ? 'Attack (Swarm)' : 'Attack Enemy');
              if (enemyNearBase) score += 5000;
            }
          } else {
            if (targetUnit.tier === unit.tier && baseDistMove > baseDistCurr) {
              const mergedPoints = this.combat.calculateTotalPoints(unit) + this.combat.calculateTotalPoints(targetUnit);
              const { tier } = this.combat.calculateTierAndLevel(mergedPoints);
              if (tier > unit.tier && !nearBase && !isOnForest) {
                score = 1000;
                reason = 'Merge Up';
              }
            }
          }
        }
        let type: 'move' | 'attack' | 'merge' = 'move';
        if (targetUnit && targetUnit.owner === 'player') type = 'attack';
        if (targetUnit && targetUnit.owner === 'ai' && targetUnit.tier === unit.tier) type = 'merge';
        if (returning) {
          score = Math.floor(score * 0.1);
        }
        if ((unit.forestOccupationTurns ?? 0) > 0 && (move.x !== unit.position.x || move.y !== unit.position.y)) {
          score -= 2000;
        }
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
