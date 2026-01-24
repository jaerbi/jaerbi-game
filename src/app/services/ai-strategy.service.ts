import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';
import { CombatService } from './combat.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class AiStrategyService {
  constructor(private combat: CombatService, private settings: SettingsService) {}

  pickBestMove(engine: any): { unit: Unit; target: Position } | null {
    const aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai');
    if (aiUnits.length === 0) return null;
    const playerBase: Position = { x: 0, y: 0 };
    const aiBase: Position = engine.getBasePosition('ai');
    const totalForests = engine.forestsSignal().length;
    const playerForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'player' && engine.isForest(u.position.x, u.position.y)).length;
    const aiForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && engine.isForest(u.position.x, u.position.y)).length;
    const baseScouted = engine.isVisibleToAi(playerBase.x, playerBase.y) || engine.isExploredByAi(playerBase.x, playerBase.y);
    const controlRatio = totalForests > 0 ? aiForestCount / totalForests : 0;
    const siegeGate = baseScouted && controlRatio >= 0.4;
    if (siegeGate) {
      for (const u of aiUnits) {
        const moves = engine.calculateValidMoves(u);
        const target = moves.find((m: Position) => m.x === playerBase.x && m.y === playerBase.y);
        if (target) return { unit: u, target };
      }
    }
    const aggroMode = aiUnits.length > 5 && !engine.unitsSignal().some((u: Unit) => u.owner === 'player' && (Math.abs(u.position.x - aiBase.x) + Math.abs(u.position.y - aiBase.y)) <= 3);
    const forests: Position[] = engine.forestsSignal();
    const unoccupiedForests = forests.filter(f => !engine.getUnitAt(f.x, f.y));
    const reconNeeded = unoccupiedForests.length === 0;
    const playerForestUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'player' && engine.isForest(u.position.x, u.position.y))
      .sort((a: Unit, b: Unit) => this.combat.calculateTotalPoints(a) - this.combat.calculateTotalPoints(b));
    const weakestForestTarget = playerForestUnits.length ? playerForestUnits[0].position : null;
    const crisisMode = totalForests > 0 && playerForestCount / totalForests > 0.7;
    const monopolyThreat = engine.forestMonopolySignal().player >= 5;
    let best: { unit: Unit; target: Position; score: number } | null = null;
    for (const unit of aiUnits) {
      const moves = engine.calculateValidMoves(unit);
      const limit = engine.gridSize > 30 ? 16 : 64;
      for (const move of moves.slice(0, limit)) {
        let score = 0;
        const dist = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
        score -= dist * 10;
        if (aggroMode) {
          const towardPlayerHalf = (move.x <= Math.floor(engine.gridSize / 2)) || (move.y <= Math.floor(engine.gridSize / 2));
          if (towardPlayerHalf) score += 600;
          if (!engine.getUnitAt(move.x, move.y)) score += 200;
        }
        if (this.settings.isNightmare() && reconNeeded && unit.tier >= 3) {
          const currDist = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
          const moveDist = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
          if (moveDist < currDist) score += 10000;
        }
        if (crisisMode && weakestForestTarget) {
          const currW = Math.abs(unit.position.x - weakestForestTarget.x) + Math.abs(unit.position.y - weakestForestTarget.y);
          const moveW = Math.abs(move.x - weakestForestTarget.x) + Math.abs(move.y - weakestForestTarget.y);
          if (moveW < currW) score += 8000;
        }
        if (monopolyThreat) {
          const currF = forests.length ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
          const moveF = forests.length ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
          if (moveF < currF) score += 2000;
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
        const nearBase = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y)) <= 1;
        const currDistToCenter = Math.abs(unit.position.x - center.x) + Math.abs(unit.position.y - center.y);
        const moveDistToCenter = Math.abs(move.x - center.x) + Math.abs(move.y - center.y);
        if (stationaryLong && nearBase && moveDistToCenter < currDistToCenter) {
          score += aggroMode ? 600 : 150;
        }
        if (stutter) {
          if (moveDistToCenter < currDistToCenter) score += 5000;
          const unexplored = forests.filter(f => !engine.isExploredByAi(f.x, f.y));
          if (unexplored.length > 0) {
            const currU = Math.min(...unexplored.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)));
            const moveU = Math.min(...unexplored.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)));
            if (moveU < currU) score += 3000;
          }
          if (hist.length >= 2 && move.x === hist[1].x && move.y === hist[1].y) score -= 6000;
        }
        const isThirdConsecutive = engine.lastAiMovedUnitIdSignal() === unit.id && engine.aiConsecMovesSignal() >= 2;
        if (isThirdConsecutive) {
          const alreadyOnForest = engine.isForest(unit.position.x, unit.position.y);
          const landsOnForest = engine.isForest(move.x, move.y);
          const unoccupiedAtMove = !engine.getUnitAt(move.x, move.y);
          if (!alreadyOnForest && landsOnForest && unoccupiedAtMove) {
            score += 12000;
          } else {
            score -= 12000;
          }
        }
        const targetUnit = engine.getUnitAt(move.x, move.y);
        if (targetUnit) {
          if (targetUnit.owner === 'ai') {
            if (targetUnit.tier === unit.tier) {
              const nearAiBase = (Math.abs(unit.position.x - aiBase.x) + Math.abs(unit.position.y - aiBase.y)) <= 3;
              let mergeBase = (unit.tier <= 2 ? 250 : 80);
              if (nearAiBase) mergeBase = Math.floor(mergeBase * 0.2);
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
              if (engine.isForest(move.x, move.y) || movingTowardPlayer) {
                score += mergeBase;
                const mergedPoints = this.combat.calculateTotalPoints(unit) + this.combat.calculateTotalPoints(targetUnit);
                const { tier } = this.combat.calculateTierAndLevel(mergedPoints);
                if (tier > unit.tier) score += 30;
              } else {
                score -= 100;
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
              } else if (myPower < enemyPower) {
                score -= aggroMode ? 200 : (this.settings.isNightmare() ? 800 : 1200);
              } else {
                score -= aggroMode ? 0 : (this.settings.isNightmare() ? 20 : 50);
              }
            }
          }
        }
        const nearestForestDistCurrent = forests.length
          ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)))
          : Infinity;
        const nearestForestDistMove = forests.length
          ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)))
          : Infinity;
        if (engine.isForest(move.x, move.y)) {
          const baseGreed = engine.aiWoodSignal() < 40 ? 800 : 400;
          const baseThreat = engine.unitsSignal().some((u: Unit) => u.owner === 'player' && (Math.abs(u.position.x - aiBase.x) + Math.abs(u.position.y - aiBase.y)) <= 1);
          const greed = baseThreat ? baseGreed : baseGreed * 8;
          score += greed;
          if (unit.tier === 1 && !engine.getUnitAt(move.x, move.y)) score += 3000;
          if (crisisMode || aggroMode) score += 4000;
          const allyAtMove = engine.getUnitAt(move.x, move.y);
          if (allyAtMove && allyAtMove.owner === 'ai') score -= 4000;
        } else if (nearestForestDistMove < nearestForestDistCurrent) {
          score += 180 * (nearestForestDistCurrent - nearestForestDistMove);
        }
        const unocc = forests.filter(f => !engine.getUnitAt(f.x, f.y));
        if (unocc.length > 0) {
          const currUnocc = Math.min(...unocc.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y)));
          const moveUnocc = Math.min(...unocc.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y)));
          if (moveUnocc < currUnocc) score += 1200 * (currUnocc - moveUnocc);
        }
        if (move.x <= Math.floor(engine.gridSize / 2)) score += aggroMode ? 300 : 30;
        if (move.y <= Math.floor(engine.gridSize / 2)) score += aggroMode ? 200 : 20;
        const distFromAiBase = Math.abs(move.x - aiBase.x) + Math.abs(move.y - aiBase.y);
        score += aggroMode ? distFromAiBase * 90 : distFromAiBase * 45;
        if (unit.position.x === aiBase.x && unit.position.y === aiBase.y) {
          score += 500;
        }
        const targetUnitAtMove = engine.getUnitAt(move.x, move.y);
        const weakAttack = !!(targetUnitAtMove && targetUnitAtMove.owner === 'player' && this.combat.calculateTotalPoints(unit) < this.combat.calculateTotalPoints(targetUnitAtMove));
        if (best === null || score > best.score) {
          best = { unit, target: move, score };
        }
      }
    }
    return best ? { unit: best.unit, target: best.target } : null;
  }
}
