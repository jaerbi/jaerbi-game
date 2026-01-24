import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';
import { CombatService } from './combat.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class AiStrategyService {
  constructor(private combat: CombatService, private settings: SettingsService) {}

  pickBestMove(engine: any): { unit: Unit; target: Position; reason: string } | null {
    const aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai');
    if (aiUnits.length === 0) return null;
    const playerBase: Position = { x: 0, y: 0 };
    const aiBase: Position = engine.getBasePosition('ai');
    const totalForests = engine.forestsSignal().length;
    const playerForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'player' && engine.isForest(u.position.x, u.position.y)).length;
    const aiForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && engine.isForest(u.position.x, u.position.y)).length;
    const baseScouted = engine.isVisibleToAi(playerBase.x, playerBase.y) || engine.isExploredByAi(playerBase.x, playerBase.y);
    const localAdvantage = (() => {
      const radius = 3;
      const aiNearby = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && Math.max(Math.abs(u.position.x - playerBase.x), Math.abs(u.position.y - playerBase.y)) <= radius);
      const plNearby = engine.unitsSignal().filter((u: Unit) => u.owner === 'player' && Math.max(Math.abs(u.position.x - playerBase.x), Math.abs(u.position.y - playerBase.y)) <= radius);
      const sum = (arr: Unit[]) => arr.reduce((t, u) => t + this.combat.calculateTotalPoints(u), 0);
      return sum(aiNearby) >= sum(plNearby);
    })();
    if (baseScouted && localAdvantage) {
      for (const u of aiUnits) {
        const moves = engine.calculateValidMoves(u);
        const target = moves.find((m: Position) => m.x === playerBase.x && m.y === playerBase.y);
        if (target) return { unit: u, target, reason: 'Base Snipe' };
      }
    }
    const aggroMode = aiUnits.length > 5 && !engine.unitsSignal().some((u: Unit) => u.owner === 'player' && (Math.abs(u.position.x - aiBase.x) + Math.abs(u.position.y - aiBase.y)) <= 3);
    const forests: Position[] = engine.forestsSignal();
    const unoccupiedForests = forests.filter(f => !engine.getUnitAt(f.x, f.y));
    const visibleFreeForests = unoccupiedForests.filter(f => engine.isVisibleToAi(f.x, f.y));
    const fogCoveredForests = forests.filter(f => !engine.isVisibleToAi(f.x, f.y));
    const reconNeeded = visibleFreeForests.length === 0;
    const playersAll: Unit[] = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
    const playerForestUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'player' && engine.isForest(u.position.x, u.position.y))
      .sort((a: Unit, b: Unit) => this.combat.calculateTotalPoints(a) - this.combat.calculateTotalPoints(b));
    const weakestForestTarget = playerForestUnits.length ? playerForestUnits[0].position : null;
    const crisisMode = totalForests > 0 && playerForestCount / totalForests > 0.7;
    // Full Blitz: Reduce monopoly threshold to 50% (Rule 3)
    const monopolyThreat = totalForests > 0 && (playerForestCount / totalForests) >= 0.5;
    let best: { unit: Unit; target: Position; score: number; reason: string } | null = null;
    const eliteLeader = aiUnits.find((u: Unit) => u.tier >= 3) || null;
    const clusterNearAiBase = aiUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3).length > 3;
    const forestsVulnerability = forests.map(f => {
      const players = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
      const nearest = players.length ? Math.min(...players.map((p: Unit) => Math.abs(p.position.x - f.x) + Math.abs(p.position.y - f.y))) : Infinity;
      return { f, nearest };
    }).sort((a, b) => b.nearest - a.nearest);
    const mostVulnerableForest = forestsVulnerability.length ? forestsVulnerability[0].f : null;

    // --- Critical Fixes: Anti-Stagnation & Base Congestion ---
    const baseCongested = clusterNearAiBase || aiUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 2).length >= 5;

    console.log(`[AI Thinking] Units: ${aiUnits.length}, Base Congested: ${baseCongested}, Forests: ${totalForests} (AI: ${aiForestCount})`);

    for (const unit of aiUnits) {
      const moves = engine.calculateValidMoves(unit);
      const limit = engine.gridSize > 30 ? 16 : 64;
      
      // Fix: Check stagnation (near base for > 2 turns)
      const nearBase = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y)) <= 2;
      const timeNearBase = engine.aiUnitTimeNearBase().get(unit.id) || 0;
      const isStagnant = timeNearBase >= 2;

      for (const move of moves.slice(0, limit)) {
        let score = 0;
        let reason = 'General Movement';
        
        const dist = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
        score -= dist * 10;
        
        // --- Priority 1 & 7: Forest Expansion and Fog Recon ---
        // Target ALL known forests, even if in Fog; if no visible free forests, push toward fog-covered forest coords
        const nearestForestDistCurrent = forests.length
          ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)))
          : Infinity;
        const nearestForestDistMove = forests.length
          ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)))
          : Infinity;
        const nearestVisibleFreeCurrent = visibleFreeForests.length
          ? Math.min(...visibleFreeForests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)))
          : Infinity;
        const nearestVisibleFreeMove = visibleFreeForests.length
          ? Math.min(...visibleFreeForests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)))
          : Infinity;
        const nearestFogForestCurrent = fogCoveredForests.length
          ? Math.min(...fogCoveredForests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)))
          : Infinity;
        const nearestFogForestMove = fogCoveredForests.length
          ? Math.min(...fogCoveredForests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)))
          : Infinity;

        if (engine.isForest(move.x, move.y)) {
            // Huge bonus for actually entering a forest
            score += 5000;
            reason = 'Capture Forest';
            // Extra bonus if we don't own any forests yet (Priority 0)
            if (aiForestCount < 3) {
                 score += 5000;
                 reason = 'Priority 0: Early Forest Capture';
            }
        } else {
          // Prefer visible free forests; fallback to fog recon
          if (nearestVisibleFreeMove < nearestVisibleFreeCurrent) {
            let forestSeekBonus = 600 * (nearestVisibleFreeCurrent - nearestVisibleFreeMove);
            if (aiForestCount < 3) forestSeekBonus *= 2;
            score += forestSeekBonus;
            reason = 'Priority 1: Seek Visible Free Forest';
          } else if (reconNeeded && nearestFogForestMove < nearestFogForestCurrent) {
            let reconBonus = 900 * (nearestFogForestCurrent - nearestFogForestMove);
            if (aiForestCount < 3) reconBonus *= 2;
            score += reconBonus;
            reason = 'Priority 7: Fog Recon Forest';
          } else if (nearestForestDistMove < nearestForestDistCurrent) {
            // General forest drift
            let forestSeekBonus = 300 * (nearestForestDistCurrent - nearestForestDistMove);
            if (aiForestCount < 3) forestSeekBonus *= 2;
            score += forestSeekBonus;
            reason = 'Seek Forest';
          }
        }

        // --- Fix: Anti-Stagnation & Base Clearing ---
        const distFromAiBase = Math.abs(move.x - aiBase.x) + Math.abs(move.y - aiBase.y);
        const currDistFromAiBase = Math.abs(unit.position.x - aiBase.x) + Math.abs(unit.position.y - aiBase.y);
        
        // If stagnant or base is congested, force movement AWAY from base, preferably toward forests/enemies
        if ((isStagnant || baseCongested) && nearBase) {
          const players = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
          const nearestEnemyDistCurrent = players.length
            ? Math.min(...players.map((p: Unit) => Math.abs(unit.position.x - p.position.x) + Math.abs(unit.position.y - p.position.y)))
            : Infinity;
          const nearestEnemyDistMove = players.length
            ? Math.min(...players.map((p: Unit) => Math.abs(move.x - p.position.x) + Math.abs(move.y - p.position.y)))
            : Infinity;
          const towardForest = nearestForestDistMove < nearestForestDistCurrent;
          const towardEnemy = nearestEnemyDistMove < nearestEnemyDistCurrent;
          if (distFromAiBase > currDistFromAiBase && (towardForest || towardEnemy)) {
            score += 12000;
            reason = towardForest ? 'Priority 2: Exit Toward Forest' : 'Priority 2: Exit Toward Enemy';
          }
        }

        if (aggroMode) {
          const towardPlayerHalf = (move.x <= Math.floor(engine.gridSize / 2)) || (move.y <= Math.floor(engine.gridSize / 2));
          if (towardPlayerHalf) score += 600;
          if (!engine.getUnitAt(move.x, move.y)) score += 200;
        }
        if (this.settings.isNightmare() && reconNeeded && unit.tier >= 3) {
          const currDist = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
          const moveDist = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
          if (moveDist < currDist) {
              score += 10000;
              reason = 'Nightmare Recon';
          }
        }
        if (crisisMode && weakestForestTarget) {
          const currW = Math.abs(unit.position.x - weakestForestTarget.x) + Math.abs(unit.position.y - weakestForestTarget.y);
          const moveW = Math.abs(move.x - weakestForestTarget.x) + Math.abs(move.y - weakestForestTarget.y);
          if (moveW < currW) {
              score += 8000;
              reason = 'Crisis Counter-Attack';
          }
        }
        if (monopolyThreat) {
          const currF = forests.length ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
          const moveF = forests.length ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
          if (moveF < currF) {
              score += 2000;
              reason = 'Full Blitz (Monopoly Threat)';
          }
        }
        const histMap = new Map(engine.unitMoveHistorySignal());
        const histRaw = histMap.get(unit.id);
        const hist: Position[] = Array.isArray(histRaw) ? (histRaw as Position[]) : [];
        const stutter = hist.length >= 4 &&
          hist[0].x === hist[2].x && hist[0].y === hist[2].y &&
          hist[1].x === hist[3].x && hist[1].y === hist[3].y &&
          (hist[0].x !== hist[1].x || hist[0].y !== hist[1].y);
        const center = { x: Math.floor(engine.gridSize / 2), y: Math.floor(engine.gridSize / 2) };
        const stationaryLong = (unit.turnsStationary ?? 0) >= 2;
        // nearBase defined above
        const currDistToCenter = Math.abs(unit.position.x - center.x) + Math.abs(unit.position.y - center.y);
        const moveDistToCenter = Math.abs(move.x - center.x) + Math.abs(move.y - center.y);
        if (stationaryLong && nearBase && moveDistToCenter < currDistToCenter) {
          score += aggroMode ? 600 : 150;
        }
        if (stutter) {
          if (moveDistToCenter < currDistToCenter) {
              score += 5000;
              reason = 'Anti-Stutter';
          }
          const unexplored = forests.filter(f => !engine.isExploredByAi(f.x, f.y));
          if (unexplored.length > 0) {
            const currU = Math.min(...unexplored.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)));
            const moveU = Math.min(...unexplored.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)));
            if (moveU < currU) {
                score += 3000;
                reason = 'Anti-Stutter Explore';
            }
          }
          if (hist.length >= 2 && move.x === hist[1].x && move.y === hist[1].y) score -= 6000;
        }
        const bias = engine.unitQuadrantBias().get(unit.id) as { quadrant: number; until: number } | undefined;
        if (bias && bias.until >= engine.turnSignal()) {
          const centerBias = { x: Math.floor(engine.gridSize / 2), y: Math.floor(engine.gridSize / 2) };
          const targetCenter = [
            { x: 0, y: 0 },
            { x: engine.gridSize - 1, y: 0 },
            { x: 0, y: engine.gridSize - 1 },
            { x: engine.gridSize - 1, y: engine.gridSize - 1 }
          ][bias.quadrant];
          const currD = Math.abs(unit.position.x - targetCenter.x) + Math.abs(unit.position.y - targetCenter.y);
          const moveD = Math.abs(move.x - targetCenter.x) + Math.abs(move.y - targetCenter.y);
          if (moveD < currD) {
              score += 7000;
              reason = 'Quadrant Bias';
          }
        }
        const isThirdConsecutive = engine.lastAiMovedUnitIdSignal() === unit.id && engine.aiConsecMovesSignal() >= 2;
        if (isThirdConsecutive) {
          const alreadyOnForest = engine.isForest(unit.position.x, unit.position.y);
          const landsOnForest = engine.isForest(move.x, move.y);
          const unoccupiedAtMove = !engine.getUnitAt(move.x, move.y);
          if (!alreadyOnForest && landsOnForest && unoccupiedAtMove) {
            score += 12000;
            reason = 'Consecutive Move Capture';
          } else {
            score -= 12000;
          }
        }
        const targetUnit = engine.getUnitAt(move.x, move.y);
        if (targetUnit) {
          if (targetUnit.owner === 'ai') {
            if (targetUnit.tier === unit.tier) {
              const nearAiBaseLocal = (Math.abs(unit.position.x - aiBase.x) + Math.abs(unit.position.y - aiBase.y)) <= 3;
              let mergeBase = (unit.tier <= 2 ? 250 : 80);
              if (nearAiBaseLocal) mergeBase = Math.floor(mergeBase * 0.2);
              if (clusterNearAiBase) mergeBase += 8000;
              const players = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
              let nearestTargetDistCurrent = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
              let nearestTargetDistMove = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
              if (players.length > 0) {
                nearestTargetDistCurrent = Math.min(
                  nearestTargetDistCurrent,
                  ...players.map((p: Unit) => Math.abs(unit.position.x - p.position.x) + Math.abs(unit.position.y - p.position.y))
                );
                nearestTargetDistMove = Math.min(
                  nearestTargetDistMove,
                  ...players.map((p: Unit) => Math.abs(move.x - p.position.x) + Math.abs(move.y - p.position.y))
                );
              }
              const movingTowardPlayer = nearestTargetDistMove < nearestTargetDistCurrent;
              // Reduce merge desire near base unless it helps exit or capture forest
              const helpsExit = distFromAiBase > currDistFromAiBase;
              if ((engine.isForest(move.x, move.y) || movingTowardPlayer || helpsExit) && !(nearAiBaseLocal && !helpsExit)) {
                score += mergeBase;
                const mergedPoints = this.combat.calculateTotalPoints(unit) + this.combat.calculateTotalPoints(targetUnit);
                const { tier } = this.combat.calculateTierAndLevel(mergedPoints);
                if (tier > unit.tier) score += 30;
                reason = 'Merge Up';
              } else {
                score -= 500;
              }
            }
          } else {
            if (engine.isVisibleToAi(move.x, move.y)) {
              const enemyPower = this.combat.calculateTotalPoints(targetUnit);
              const myPower = this.combat.calculateTotalPoints(unit);
              if (myPower > enemyPower) {
                let bonus = (this.settings.isNightmare() ? 1.25 : 1.0) * (100 + (enemyPower * 2));
                if (engine.isForest(move.x, move.y)) bonus = Math.floor(bonus * 3);
                if (unit.tier >= 2) bonus += aggroMode ? 400 : 150;
                score += bonus;
                reason = 'Attack Enemy';
              } else if (myPower < enemyPower) {
                const hardOrNightmare = this.settings.isNightmare() || this.settings.isHard?.();
                const suicideOk = hardOrNightmare && unit.tier === 1 && targetUnit.tier >= 3;
                if (suicideOk) {
                  score += 6000;
                  reason = 'Suicide Attack (T1 vs T3)';
                } else {
                  score -= aggroMode ? 200 : (this.settings.isNightmare() ? 800 : 1200);
                }
              } else {
                score -= aggroMode ? 0 : (this.settings.isNightmare() ? 20 : 50);
              }
            }
          }
        }
        
        // ... (existing forest code) ...
        // Re-evaluating forest greed for specific move lands
        if (engine.isForest(move.x, move.y)) {
          const baseGreed = engine.aiWoodSignal() < 40 ? 800 : 400;
          const baseThreat = engine.unitsSignal().some((u: Unit) => u.owner === 'player' && (Math.abs(u.position.x - aiBase.x) + Math.abs(u.position.y - aiBase.y)) <= 1);
          const greed = baseThreat ? baseGreed : baseGreed * 8;
          score += greed;
          if (unit.tier === 1 && !engine.getUnitAt(move.x, move.y)) score += 3000;
          if (crisisMode || aggroMode) score += 4000;
          const allyAtMove = engine.getUnitAt(move.x, move.y);
          if (allyAtMove && allyAtMove.owner === 'ai') score -= 4000;
          
          if (score > (best?.score || -Infinity)) {
              reason = 'Forest Greed / Capture';
          }
        } 

        // Blockers logic
        const nearestForest = forests.length
          ? forests.reduce((acc, f) => {
              const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
              return d < acc.dist ? { f, dist: d } : acc;
            }, { f: forests[0], dist: Math.abs(unit.position.x - forests[0].x) + Math.abs(unit.position.y - forests[0].y) }).f
          : null;
        if (nearestForest) {
          const stepX = Math.sign(nearestForest.x - unit.position.x);
          const stepY = Math.sign(nearestForest.y - unit.position.y);
          const toward = { x: unit.position.x + stepX, y: unit.position.y + stepY };
          const blocker = playersAll.find((p: Unit) => p.position.x === toward.x && p.position.y === toward.y && this.combat.calculateTotalPoints(p) > this.combat.calculateTotalPoints(unit));
          if (blocker) {
            const movePB = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
            const currPB = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
            if (movePB < currPB) {
                score += 2000;
                reason = 'Bypass Blocker';
            }
            if (mostVulnerableForest) {
              const currVF = Math.abs(unit.position.x - mostVulnerableForest.x) + Math.abs(unit.position.y - mostVulnerableForest.y);
              const moveVF = Math.abs(move.x - mostVulnerableForest.x) + Math.abs(move.y - mostVulnerableForest.y);
              if (moveVF < currVF) score += 1500;
            }
          }
        }
        if (!engine.isForest(unit.position.x, unit.position.y)) {
          const moved = !(unit.position.x === move.x && unit.position.y === move.y);
          if (moved) score += 250;
        }
        
        // Unoccupied forest seek logic
        const unocc = forests.filter(f => !engine.getUnitAt(f.x, f.y));
        if (unocc.length > 0) {
          const currUnocc = Math.min(...unocc.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)));
          const moveUnocc = Math.min(...unocc.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)));
          if (moveUnocc < currUnocc) score += 1200 * (currUnocc - moveUnocc);
        }

        // Leader adjacency
        if (eliteLeader && unit.tier === 1) {
          const adjToLeaderMove = Math.abs(move.x - eliteLeader.position.x) + Math.abs(move.y - eliteLeader.position.y) === 1;
          if (adjToLeaderMove) {
              score += 1800;
              reason = 'Support Elite Leader';
          }
        }
        
        if (move.x <= Math.floor(engine.gridSize / 2)) score += aggroMode ? 300 : 30;
        if (move.y <= Math.floor(engine.gridSize / 2)) score += aggroMode ? 200 : 20;
        const distFromAiBaseScore = Math.abs(move.x - aiBase.x) + Math.abs(move.y - aiBase.y);
        score += aggroMode ? distFromAiBaseScore * 90 : distFromAiBaseScore * 45;
        if (unit.position.x === aiBase.x && unit.position.y === aiBase.y) {
          score += 500;
        }
        const targetUnitAtMove = engine.getUnitAt(move.x, move.y);
        const weakAttack = !!(targetUnitAtMove && targetUnitAtMove.owner === 'player' && this.combat.calculateTotalPoints(unit) < this.combat.calculateTotalPoints(targetUnitAtMove));
        
        if (best === null || score > best.score) {
          best = { unit, target: move, score, reason };
        }
      }
    }
    return best ? { unit: best.unit, target: best.target, reason: best.reason } : null;
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
