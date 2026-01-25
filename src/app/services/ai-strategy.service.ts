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

  chooseBestEndingAction(engine: any): { type: 'move' | 'attack' | 'merge' | 'wall_attack'; unit: Unit; target: Position; reason: string; edge?: { from: Position; to: Position } } | null {
    const alreadyMoved: Set<string> = new Set(engine.movedThisTurnSignal?.() ?? []);
    const aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && !alreadyMoved.has(u.id));
    if (aiUnits.length === 0) return null;
    const aiBase: Position = engine.getBasePosition('ai');
    const playerBase: Position = engine.getBasePosition('player');
    const forests: Position[] = engine.forestsSignal();
    const unoccupied = forests.filter(f => !engine.getUnitAt(f.x, f.y));
    const visibleFree = unoccupied.filter(f => engine.isVisibleToAi(f.x, f.y));
    const fogForests = forests.filter(f => !engine.isVisibleToAi(f.x, f.y));
    const aiForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && engine.isForest(u.position.x, u.position.y)).length;
    const playerUnits: Unit[] = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
    const enemyNearBase = playerUnits.some((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3);
    const baseThreatEnemies = playerUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3);
    const baseThreat = baseThreatEnemies.length > 0;
    const immediateThreatEnemies = baseThreatEnemies.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 2);
    const immediateThreat = immediateThreatEnemies.length > 0;
    const baseProximity = playerUnits.some((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 5);
    const aggression = typeof engine.aggressionMode === 'function' ? !!engine.aggressionMode() : (playerUnits.filter((p: Unit) => engine.isForest(p.position.x, p.position.y)).length * 2) >= (aiUnits.filter((a: Unit) => engine.isForest(a.position.x, a.position.y)).length * 2);
    let best: { unit: Unit; target: Position; score: number; type: 'move' | 'attack' | 'merge' | 'wall_attack'; reason: string; edge?: { from: Position; to: Position } } | null = null;
    const clusterCount = aiUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3).length;
    const center = { x: Math.floor(engine.gridSize / 2), y: Math.floor(engine.gridSize / 2) };
    const primaryThreat = baseThreatEnemies.length > 0 ? baseThreatEnemies.reduce((acc, e) => {
      const d = Math.max(Math.abs(e.position.x - aiBase.x), Math.abs(e.position.y - aiBase.y));
      const da = Math.max(Math.abs(acc.position.x - aiBase.x), Math.abs(acc.position.y - aiBase.y));
      return d < da ? e : acc;
    }, baseThreatEnemies[0]) : null;
    const blockingTiles: Position[] = [];
    if (primaryThreat) {
      let cx = primaryThreat.position.x;
      let cy = primaryThreat.position.y;
      const stepX = Math.sign(aiBase.x - cx);
      const stepY = Math.sign(aiBase.y - cy);
      while (cx !== aiBase.x || cy !== aiBase.y) {
        cx += stepX;
        cy += stepY;
        if (!engine.inBounds(cx, cy)) break;
        if (cx === aiBase.x && cy === aiBase.y) break;
        blockingTiles.push({ x: cx, y: cy });
      }
    }
    const timeMap: Map<string, number> = new Map(engine.aiUnitTimeNearBase());
    const stutterBan: Map<string, { tiles: Set<string>; until: number }> = new Map(engine.unitStutterBanSignal?.() ?? new Map());
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
        Math.max(Math.abs(u2.position.x - unit.position.x), Math.abs(u2.position.y - unit.position.y)) <= 1
      );
      if (inSession && !baseProximity && unit.tier < 3) {
        this.goals.set(unit.id, { x: unit.position.x, y: unit.position.y });
        console.log(`[AI Block] Unit ${unit.id} is blocked in the forest at (${unit.position.x},${unit.position.y}). Progress: ${(unit.forestOccupationTurns ?? 0)}/3.`);
        continue;
      }
      if (unit.tier >= 3) {
        const allForests = forests;
        const nearestForest = allForests.length
          ? allForests.reduce((acc, f) => {
              const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
              const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
              return d < da ? f : acc;
            }, allForests[0])
          : null;
        const fresh = (unit.forestOccupationTurns ?? 0) === 0 && !isOnForest;
        if (fresh && nearestForest) {
          goal = { x: nearestForest.x, y: nearestForest.y };
          this.goals.set(unit.id, goal);
        }
        if (isOnForest && lowTierNearby) {
          this.goals.set(unit.id, { x: playerBase.x, y: playerBase.y });
          const neighbors: Position[] = [
            { x: unit.position.x + 1, y: unit.position.y },
            { x: unit.position.x - 1, y: unit.position.y },
            { x: unit.position.x, y: unit.position.y + 1 },
            { x: unit.position.x, y: unit.position.y - 1 }
          ].filter(p => engine.inBounds(p.x, p.y));
          const blockedNeighbors = neighbors.filter(n => !!engine.getWallBetween(unit.position.x, unit.position.y, n.x, n.y));
          if (blockedNeighbors.length === neighbors.length) {
            const towardBase = neighbors.reduce((acc, n) => {
              const db = Math.abs(n.x - playerBase.x) + Math.abs(n.y - playerBase.y);
              const da = Math.abs(acc.x - playerBase.x) + Math.abs(acc.y - playerBase.y);
              return db < da ? n : acc;
            });
            best = { unit, target: { x: unit.position.x, y: unit.position.y }, score: 2200000, type: 'wall_attack', reason: 'Siege: Breakthrough (Handover)', edge: { from: { ...unit.position }, to: towardBase } };
            continue;
          }
        }
      }
      const canAttackBaseNow = moves.some(m => m.x === playerBase.x && m.y === playerBase.y);
      if (canAttackBaseNow) {
        const score = 2500000;
        const reason = 'Siege: Attack Base';
        if (best === null || score > best.score) {
          best = { unit, target: { x: playerBase.x, y: playerBase.y }, score, type: 'attack', reason };
        }
      } else {
        const baseNeighbors: Position[] = [
          { x: playerBase.x + 1, y: playerBase.y },
          { x: playerBase.x - 1, y: playerBase.y },
          { x: playerBase.x, y: playerBase.y + 1 },
          { x: playerBase.x, y: playerBase.y - 1 }
        ].filter(p => engine.inBounds(p.x, p.y));
        for (const nb of baseNeighbors) {
          const wBase = engine.getWallBetween(playerBase.x, playerBase.y, nb.x, nb.y);
          if (wBase && wBase.owner === 'neutral') {
            const onEndpoint = (unit.position.x === nb.x && unit.position.y === nb.y) || (unit.position.x === playerBase.x && unit.position.y === playerBase.y);
            if (onEndpoint) {
              const score = 2000000;
              const reason = 'Siege: Destroy Base Wall';
              if (best === null || score > best.score) {
                best = { unit, target: { ...unit.position }, score, type: 'wall_attack', reason, edge: { from: { x: playerBase.x, y: playerBase.y }, to: { x: nb.x, y: nb.y } } };
              }
            } else {
              const canStepToEndpoint = moves.some(m => (m.x === nb.x && m.y === nb.y) || (m.x === playerBase.x && m.y === playerBase.y));
              if (canStepToEndpoint) {
                const endpoint = moves.find(m => (m.x === nb.x && m.y === nb.y) || (m.x === playerBase.x && m.y === playerBase.y))!;
                const score = 1800000;
                const reason = 'Siege: Position at Base Wall';
                if (best === null || score > best.score) {
                  best = { unit, target: { x: endpoint.x, y: endpoint.y }, score, type: 'move', reason };
                }
              }
            }
          }
        }
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
      let breachTarget: Position | null = null;
      if (goal && engine.isForest(goal.x, goal.y) && !engine.getUnitAt(goal.x, goal.y)) {
        const neighbors: Position[] = [
          { x: goal.x + 1, y: goal.y },
          { x: goal.x - 1, y: goal.y },
          { x: goal.x, y: goal.y + 1 },
          { x: goal.x, y: goal.y - 1 }
        ].filter(p => engine.inBounds(p.x, p.y));
        const breachables = neighbors.filter(n => {
          const w = engine.getWallBetween(n.x, n.y, goal.x, goal.y);
          return !!(w && w.owner === 'neutral');
        });
        if (breachables.length > 0) {
          breachTarget = breachables.reduce((acc, n) => {
            const dAcc = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
            const dN = Math.abs(unit.position.x - n.x) + Math.abs(unit.position.y - n.y) + 3;
            return dN < dAcc ? n : acc;
          }, breachables[0]);
        }
      }
      const adjDirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 }
      ];
      for (const dxy of adjDirs) {
        const fTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
        if (!engine.inBounds(fTile.x, fTile.y)) continue;
        if (!engine.isForest(fTile.x, fTile.y)) continue;
        const occupant = engine.getUnitAt(fTile.x, fTile.y);
        if (occupant) continue;
        const wall = engine.getWallBetween(unit.position.x, unit.position.y, fTile.x, fTile.y);
        if (wall && wall.owner === 'neutral') {
          const score = 900000;
          const reason = 'Breach Neutral Wall to Forest';
          if (best === null || score > best.score) {
            best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: fTile } };
          }
        } else if (wall && wall.owner === 'player') {
          const neighbors: Position[] = [
            { x: fTile.x + 1, y: fTile.y },
            { x: fTile.x - 1, y: fTile.y },
            { x: fTile.x, y: fTile.y + 1 },
            { x: fTile.x, y: fTile.y - 1 }
          ].filter(p => engine.inBounds(p.x, p.y));
          const alternatives = neighbors.filter(n => {
            if (engine.getUnitAt(n.x, n.y)) return false;
            const w2 = engine.getWallBetween(n.x, n.y, fTile.x, fTile.y);
            return !w2;
          });
          const dDirect = Math.abs(unit.position.x - fTile.x) + Math.abs(unit.position.y - fTile.y);
          const dAlt = alternatives.length > 0
            ? alternatives.reduce((acc, n) => {
                const d = Math.abs(unit.position.x - n.x) + Math.abs(unit.position.y - n.y) + 1;
                return Math.min(acc, d);
              }, Infinity)
            : Infinity;
          if (dAlt - dDirect > 4) {
            const score = 850000;
            const reason = 'Attack Player Wall to Forest';
            if (best === null || score > best.score) {
              best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: fTile } };
            }
          }
        }
      }
      // Base adjacency breach for hunters
      for (const dxy of adjDirs) {
        const bTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
        if (bTile.x === playerBase.x && bTile.y === playerBase.y) {
          const w = engine.getWallBetween(unit.position.x, unit.position.y, bTile.x, bTile.y);
          if (w && (w.owner === 'neutral' || w.owner === 'player') && unit.tier >= 3) {
            const score = 900000;
            const reason = 'Breach Wall to Base';
            if (best === null || score > best.score) {
              best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: bTile } };
            }
          }
        }
      }
      // Anti-stagnation: break out from neutral walls near base or with no clear forest path
      const noClearForestPath = visibleFree.length === 0 && fogForests.length === 0 && !breachTarget;
      if (stagnantTurns >= 2 && noClearForestPath) {
        for (const dxy of adjDirs) {
          const nTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
          if (!engine.inBounds(nTile.x, nTile.y)) continue;
          const w = engine.getWallBetween(unit.position.x, unit.position.y, nTile.x, nTile.y);
          if (w && w.owner === 'neutral') {
            const score = 800000;
            const reason = 'Anti-Stagnation: Break Out';
            if (best === null || score > best.score) {
              best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: nTile } };
            }
          }
        }
      }
      const adjacentEnemies = playerUnits.filter(p => Math.max(Math.abs(p.position.x - unit.position.x), Math.abs(p.position.y - unit.position.y)) === 1);
      const strongestAdjEnemy = adjacentEnemies.length > 0 ? adjacentEnemies.reduce((acc, e) => (this.combat.calculateTotalPoints(e) > this.combat.calculateTotalPoints(acc) ? e : acc), adjacentEnemies[0]) : null;
      const canReachBlockingTile = blockingTiles.length > 0 && moves.some(m => blockingTiles.some(b => b.x === m.x && b.y === m.y));
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
        const prevPrevTile = hist.length >= 3 ? hist[hist.length - 3] : null;
        const returning = prevTile && move.x === prevTile.x && move.y === prevTile.y;
        const leavingForest = isOnForest && !(engine.isForest(move.x, move.y));
        const banInfo = stutterBan.get(unit.id);
        const bannedNow = banInfo && banInfo.until > engine.turnSignal() && banInfo.tiles.has(`${move.x},${move.y}`);
        const loopLastTwo = unit.tier === 1 && ((prevTile && move.x === prevTile.x && move.y === prevTile.y) || (prevPrevTile && move.x === prevPrevTile.x && move.y === prevPrevTile.y));
        if (loopLastTwo) {
          score -= 25000;
          reason = 'Anti-Loop Penalty';
        }
        if (bannedNow) {
          score -= 30000;
          reason = 'Stutter Ban Penalty';
        }
        if (isOnForest && adjacentEnemies.length === 0 && !targetUnit && leavingForest && !baseThreat) {
          score = -1000;
        }
        if (!targetUnit) {
          if (engine.isForest(move.x, move.y) && !engine.getUnitAt(move.x, move.y)) {
            if (unit.tier >= 3) {
              const lowTierWithin3 = engine.unitsSignal().some((u2: Unit) =>
                u2.owner === 'ai' && u2.tier <= 2 &&
                Math.max(Math.abs(u2.position.x - move.x), Math.abs(u2.position.y - move.y)) <= 1
              );
              const enemiesVisibleNear = playerUnits.some((p: Unit) =>
                Math.max(Math.abs(p.position.x - unit.position.x), Math.abs(p.position.y - unit.position.y)) <= 2 &&
                engine.isVisibleToAi(p.position.x, p.position.y)
              );
              const fresh = (unit.forestOccupationTurns ?? 0) === 0 && !isOnForest;
              if (fresh && !enemiesVisibleNear) {
                score = 1200000;
                reason = 'Opening: T3 occupy forest';
              } else if (!lowTierWithin3 && !enemiesVisibleNear) {
                score = 500000;
                reason = 'T3 capture forest';
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
            const towardGoalWall = (() => {
              const sx = Math.sign(goal.x - unit.position.x);
              const sy = Math.sign(goal.y - unit.position.y);
              const nx = unit.position.x + (sx !== 0 ? sx : 0);
              const ny = unit.position.y + (sy !== 0 ? sy : 0);
              if (!engine.inBounds(nx, ny)) return false;
              const w = engine.getWallBetween(unit.position.x, unit.position.y, nx, ny);
              return !!(w && w.owner === 'neutral');
            })();
            if (towardGoalWall && move.x === unit.position.x && move.y === unit.position.y) {
              score += 800000;
              reason = 'Siege: Breakthrough';
            }
          }
          if (breachTarget) {
            const dBCurr = Math.abs(unit.position.x - breachTarget.x) + Math.abs(unit.position.y - breachTarget.y);
            const dBMove = Math.abs(move.x - breachTarget.x) + Math.abs(move.y - breachTarget.y);
            if (dBMove < dBCurr) {
              score += 200000 * (dBCurr - dBMove);
              reason = 'Approach Neutral Wall to Forest';
            }
            if (move.x === breachTarget.x && move.y === breachTarget.y) {
              score += 500000;
              reason = 'Position for Wall Breach';
            }
          }
          if (move.x === playerBase.x && move.y === playerBase.y) {
            score += 10000;
            reason = 'Attack Base (Override)';
          }
          if (primaryThreat) {
            const isBlocking = blockingTiles.some(b => b.x === move.x && b.y === move.y);
            const distCurrThreat = Math.abs(unit.position.x - primaryThreat.position.x) + Math.abs(unit.position.y - primaryThreat.position.y);
            const distMoveThreat = Math.abs(move.x - primaryThreat.position.x) + Math.abs(move.y - primaryThreat.position.y);
            const threatDistToBase = Math.max(Math.abs(primaryThreat.position.x - aiBase.x), Math.abs(primaryThreat.position.y - aiBase.y));
            const threatNextTurn = threatDistToBase <= 2;
            const staying = move.x === unit.position.x && move.y === unit.position.y;
            if (isBlocking) {
              const baseScore = threatNextTurn ? 2000000 : 1200000;
              if (score < baseScore) {
                score = baseScore;
              }
              score += threatNextTurn ? 20000 : 5000;
              reason = threatNextTurn ? 'Panic Defense: Block Path To Base' : 'Defense: Block Path To Base';
            } else if (distMoveThreat < distCurrThreat) {
              score += 5000 * (distCurrThreat - distMoveThreat);
              if (unit.tier >= 3) score += 4000;
              reason = 'Defense: Move Toward Base Threat';
            }
            if (staying && canReachBlockingTile) {
              score -= threatNextTurn ? 50000 : 10000;
              if (immediateThreat) {
                reason = 'Penalty: Standing Still With Imminent Base Threat';
              } else if (baseThreat) {
                reason = 'Penalty: Standing Still With Base Threat';
              }
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
            const distTargetBase = Math.max(Math.abs(targetUnit.position.x - aiBase.x), Math.abs(targetUnit.position.y - aiBase.y));
            const targetThreateningBase = distTargetBase <= 3;
            const targetCanReachBaseNextTurn = distTargetBase <= 2;
            if (targetThreateningBase) {
              const baseScore = targetCanReachBaseNextTurn ? 2000000 : 1500000;
              score = baseScore;
              reason = targetCanReachBaseNextTurn ? 'Panic Defense: Attack Base Threat' : 'Defense: Attack Base Threat';
            } else {
              const myPower = this.combat.calculateTotalPoints(unit);
              const enemyPower = this.combat.calculateTotalPoints(targetUnit);
              const alliesNearTarget = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && u.id !== unit.id && Math.max(Math.abs(u.position.x - move.x), Math.abs(u.position.y - move.y)) === 1).length;
              if (myPower >= enemyPower || (aggression && unit.tier >= targetUnit.tier) || (myPower < enemyPower && alliesNearTarget >= 2)) {
                score = 200000;
                reason = (aggression && unit.tier >= targetUnit.tier) ? `Attack (Wood War / Equal Tier)` : (myPower < enemyPower ? 'Attack (Swarm)' : 'Attack Enemy');
                if (enemyNearBase) score += 5000;
              }
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
        const histLoop3 = (() => {
          const last6 = hist.slice(-6);
          const uniq = new Set(last6.map(p => `${p.x},${p.y}`));
          return last6.length >= 6 && uniq.size <= 3;
        })();
        if (unit.tier === 1 && histLoop3) {
          const candidates = visibleFree.length > 0 ? visibleFree : fogForests;
          if (candidates.length > 0) {
            const nearest = candidates.reduce((acc, f) => {
              const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
              const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
              return d < da ? f : acc;
            }, candidates[0]);
            const dCurr = Math.abs(unit.position.x - nearest.x) + Math.abs(unit.position.y - nearest.y);
            const dMove = Math.abs(move.x - nearest.x) + Math.abs(move.y - nearest.y);
            if (dMove < dCurr) {
              score += 100000 * (dCurr - dMove);
              reason = 'Breakout: Toward Forest';
            }
          }
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
    return { type: best.type, unit: best.unit, target: best.target, reason: best.reason, edge: (best as any).edge };
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
