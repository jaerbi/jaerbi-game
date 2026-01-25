import { Injectable, signal, computed } from '@angular/core';
import { Unit, Position, Owner } from '../models/unit.model';
import { CombatService } from './combat.service';
import { BuildService } from './build.service';
import { LogService } from './log.service';
import { SettingsService } from './settings.service';
import { MapService } from './map.service';
import { EconomyService } from './economy.service';
import { AiStrategyService } from './ai-strategy.service';

interface Wall {
  id: string;
  tile1: Position;
  tile2: Position;
  health: number;
  owner: Owner;
}

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  get gridSize(): number {
    return this.settings.mapSize();
  }
  
  // State using Signals
  private unitsSignal = signal<Unit[]>([]);
  private turnSignal = signal<number>(1);
  private selectedUnitIdSignal = signal<string | null>(null);
  private gameStatusSignal = signal<'playing' | 'player wins' | 'ai wins'>('playing');
  private lastMergedUnitIdSignal = signal<string | null>(null);
  private lastRemainderUnitIdSignal = signal<string | null>(null);
  private resourcesSignal = signal<{ wood: number }>({ wood: 0 });
  private forestsSignal = signal<Position[]>([]);
  private baseHealthSignal = signal<{ player: number; ai: number }>({ player: 100, ai: 100 });
  private reservePointsSignal = signal<{ player: number; ai: number }>({ player: 0, ai: 0 });
  private deployTargetsSignal = signal<Position[]>([]);
  private baseDeployActiveSignal = signal<boolean>(false);
  private wallsSignal = signal<Wall[]>([]);
  private playerVisibilitySignal = signal<Set<string>>(new Set<string>());
  private aiVisibilitySignal = signal<Set<string>>(new Set<string>());
  private playerExploredSignal = signal<Set<string>>(new Set<string>());
  private aiExploredSignal = signal<Set<string>>(new Set<string>());
  private unitMoveHistorySignal = signal<Map<string, Position[]>>(new Map<string, Position[]>());
  private unitStutterBanSignal = signal<Map<string, { tiles: Set<string>; until: number }>>(new Map());
  private lastAiMovedUnitIdSignal = signal<string | null>(null);
  private aiConsecMovesSignal = signal<number>(0);
  private aiSpawnQuadrantSignal = signal<number>(0);
  private buildModeSignal = signal<boolean>(false);
  private fogDebugDisabledSignal = signal<boolean>(false);
  private wallBuiltThisTurnSignal = signal<boolean>(false);
  private rulesOpenSignal = signal<boolean>(false);
  private movedThisTurnSignal = signal<Set<string>>(new Set<string>());
  private aiWoodSignal = signal<number>(0);
  private logsOpenSignal = signal<boolean>(false);
  private settingsOpenSignal = signal<boolean>(false);
  private logsSignal = signal<string[]>([]);
  private activeSideSignal = signal<Owner>('ai');
  private lastArrivedUnitIdSignal = signal<string | null>(null);
  private attackerNudgeSignal = signal<{ id: string; dx: number; dy: number } | null>(null);
  private shakenUnitIdSignal = signal<string | null>(null);
  private shakenWallIdSignal = signal<string | null>(null);
  private pulseUnitIdSignal = signal<string | null>(null);
  private screenShakeSignal = signal<boolean>(false);
  private endOverlaySignal = signal<boolean>(false);
  private endReasonSignal = signal<string | null>(null);
  private combatOnlySignal = signal<boolean>(true);
  private forestMonopolySignal = signal<{ player: number; ai: number }>({ player: 0, ai: 0 });
  private hoveredUnitIdSignal = signal<string | null>(null);
  private autoDeployEnabledSignal = signal<boolean>(false);
  private playerConvertedThisTurnSignal = signal<boolean>(false);
  private unitQuadrantBiasSignal = signal<Map<string, { quadrant: number; until: number }>>(new Map());
  private aiUnitTimeNearBaseSignal = signal<Map<string, number>>(new Map());
  private aiBatchingActions: boolean = false;
  private isAiThinking: boolean = false;
  private aggressionModeSignal = signal<boolean>(false);

  // Computed signals
  readonly units = this.unitsSignal.asReadonly();
  readonly turn = this.turnSignal.asReadonly();
  readonly selectedUnitId = this.selectedUnitIdSignal.asReadonly();
  readonly gameStatus = this.gameStatusSignal.asReadonly();
  readonly lastMergedUnitId = this.lastMergedUnitIdSignal.asReadonly();
  readonly lastRemainderUnitId = this.lastRemainderUnitIdSignal.asReadonly();
  readonly resources = this.resourcesSignal.asReadonly();
  readonly forests = this.forestsSignal.asReadonly();
  readonly baseHealth = this.baseHealthSignal.asReadonly();
  readonly reservePoints = this.reservePointsSignal.asReadonly();
  readonly deployTargets = this.deployTargetsSignal.asReadonly();
  readonly baseDeployActive = this.baseDeployActiveSignal.asReadonly();
  readonly walls = this.wallsSignal.asReadonly();
  readonly playerVisibility = this.playerVisibilitySignal.asReadonly();
  readonly aiVisibility = this.aiVisibilitySignal.asReadonly();
  readonly playerExplored = this.playerExploredSignal.asReadonly();
  readonly aiExplored = this.aiExploredSignal.asReadonly();
  readonly buildMode = this.buildModeSignal.asReadonly();
  readonly fogDebugDisabled = this.fogDebugDisabledSignal.asReadonly();
  readonly wallBuiltThisTurn = this.wallBuiltThisTurnSignal.asReadonly();
  readonly rulesOpen = this.rulesOpenSignal.asReadonly();
  readonly lastArrivedUnitId = this.lastArrivedUnitIdSignal.asReadonly();
  readonly pulseUnitId = this.pulseUnitIdSignal.asReadonly();
  readonly aiUnitTimeNearBase = this.aiUnitTimeNearBaseSignal.asReadonly();
  aggressionMode(): boolean {
    return this.aggressionModeSignal();
  }
  
  readonly selectedUnit = computed(() => 
    this.unitsSignal().find(u => u.id === this.selectedUnitIdSignal()) || null
  );

  readonly validMoves = computed(() => {
    const unit = this.selectedUnit();
    if (!unit) return [];
    return this.calculateValidMoves(unit);
  });

  // Grid dimensions
  get gridRows(): number[] {
    return Array.from({ length: this.gridSize }, (_, i) => i);
  }
  get gridCols(): number[] {
    return Array.from({ length: this.gridSize }, (_, i) => i);
  }
  get tileSizePx(): number {
    const gs = this.gridSize;
    if (gs <= 10) return 64;
    if (gs <= 20) return 48;
    return 32;
  }
  get tileMinSizePx(): number {
    const gs = this.gridSize;
    if (gs <= 10) return 64;
    if (gs <= 20) return 40;
    return 32;
  }
  get wallThicknessPx(): number {
    const gs = this.gridSize;
    if (gs <= 10) return 10;
    if (gs <= 20) return 8;
    return 6;
  }
  get iconSizePx(): number {
    const gs = this.gridSize;
    if (gs <= 10) return 12;
    if (gs <= 20) return 10;
    return 10;
  }
  get tileUnitSizePx(): number {
    return Math.round(this.tileSizePx * 0.75);
  }

  constructor(private combat: CombatService, private build: BuildService, private log: LogService, private settings: SettingsService, private map: MapService, private economy: EconomyService, private aiStrategy: AiStrategyService) {
    this.resetGame();
  }

  resetGame() {
    this.unitsSignal.set([]);
    this.turnSignal.set(1);
    this.activeSideSignal.set('ai');
    this.selectedUnitIdSignal.set(null);
    this.gameStatusSignal.set('playing');
    this.endOverlaySignal.set(false);
    this.endReasonSignal.set(null);
    this.forestMonopolySignal.set({ player: 0, ai: 0 });
    this.lastMergedUnitIdSignal.set(null);
    this.lastRemainderUnitIdSignal.set(null);
    this.resourcesSignal.set({ wood: 0 });
    this.baseHealthSignal.set({ player: 100, ai: 100 });
    this.reservePointsSignal.set({ player: 5, ai: 5 });
    this.deployTargetsSignal.set([]);
    this.forestsSignal.set(this.map.generateForests(this.gridSize, this.getBasePosition('player'), this.getBasePosition('ai')));
    const forestKeys = new Set(this.forestsSignal().map(p => `${p.x},${p.y}`));
    this.playerExploredSignal.set(new Set(forestKeys));
    this.aiExploredSignal.set(new Set(forestKeys));
    this.wallsSignal.set([]);
    this.baseDeployActiveSignal.set(false);
    this.buildModeSignal.set(false);
    this.fogDebugDisabledSignal.set(false);
    this.wallBuiltThisTurnSignal.set(false);
    this.spawnStarterArmy('player');
    this.spawnStarterArmy('ai');
    this.recomputeVisibility();
    setTimeout(() => this.aiTurn(), 10);
  }

  // --- Selection & Movement ---

  selectUnit(unitId: string | null) {
    if (this.gameStatus() !== 'playing') return;

    if (!unitId) {
      this.selectedUnitIdSignal.set(null);
      return;
    }
    
    const unit = this.unitsSignal().find(u => u.id === unitId);
    // Only allow selecting own units
    if (unit && unit.owner === 'player') { 
      this.selectedUnitIdSignal.set(unitId);
    }
  }

  moveSelectedUnit(target: Position) {
    if (this.gameStatus() !== 'playing') return;

    const unit = this.selectedUnit();
    if (!unit) return;

    const isValid = this.validMoves().some(p => p.x === target.x && p.y === target.y);
    if (!isValid) return;

    this.executeMove(unit, target);
  }

  private executeMove(unit: Unit, target: Position) {
    let consumeTurn = true;
    let merged = false;
    let remainderId: string | null = null;

    this.unitsSignal.update(units => {
      const updatedUnits = [...units];
      const unitIndex = updatedUnits.findIndex(u => u.id === unit.id);
      if (unitIndex === -1) return units;

      const movingUnit = { ...updatedUnits[unitIndex] };

      const start = { x: movingUnit.position.x, y: movingUnit.position.y };
      const dxTotal = target.x - start.x;
      const dyTotal = target.y - start.y;
      const stepX = Math.sign(dxTotal);
      const stepY = Math.sign(dyTotal);
      const steps = Math.max(Math.abs(dxTotal), Math.abs(dyTotal));

      const wallCheck = this.combat.checkWallAlongPath(start, target, movingUnit.owner, (x1, y1, x2, y2) => this.getWallBetween(x1, y1, x2, y2));
      if (wallCheck.hitOwn) {
        return updatedUnits;
      }
      if (wallCheck.hitEnemy) {
        const lastFrom = wallCheck.lastFrom!;
        const wall = this.getWallBetween(lastFrom.x, lastFrom.y, target.x, target.y)!;
        const dmgPercent = this.combat.getWallHitPercent(movingUnit.tier);
        this.wallsSignal.update(ws =>
          ws
            .map(w =>
              w.id === wall.id
                ? { ...w, health: Math.max(0, (w as any).health - dmgPercent) }
                : w
            )
            .filter((w: any) => (w.health ?? w.hitsRemaining ?? 0) > 0)
        );
        this.shakenWallIdSignal.set(wall.id);
        setTimeout(() => this.shakenWallIdSignal.set(null), 200);
        this.appendLog(`[Turn ${this.turnSignal()}] ${movingUnit.owner === 'player' ? 'Player' : 'AI'} auto-hit wall between (${lastFrom.x},${lastFrom.y})-(${target.x},${target.y}) for ${dmgPercent}% damage.`);
        return updatedUnits;
      }

      const opponentBase = this.getBasePosition(movingUnit.owner === 'player' ? 'ai' : 'player');
      if (target.x === opponentBase.x && target.y === opponentBase.y) {
        this.baseHealthSignal.update(hp => {
          const key = movingUnit.owner === 'player' ? 'ai' : 'player';
          const next = { ...hp };
          next[key] = Math.max(0, next[key] - this.calculatePower(movingUnit));
          return next;
        });
        updatedUnits.splice(unitIndex, 1);
        return updatedUnits;
      }
      
      const targetUnitIndex = updatedUnits.findIndex(u => 
        u.position.x === target.x && 
        u.position.y === target.y && 
        u.id !== movingUnit.id
      );

      if (targetUnitIndex !== -1) {
        const targetUnit = updatedUnits[targetUnitIndex];
        const lastFrom = { x: target.x - stepX, y: target.y - stepY };
        if (this.inBounds(lastFrom.x, lastFrom.y)) {
          // Block diagonal attacks through corners: check corner walls
          if (stepX !== 0 && stepY !== 0) {
            if (this.combat.isDiagonalBlocked(lastFrom, target, (x1, y1, x2, y2) => this.getWallBetween(x1, y1, x2, y2))) {
              consumeTurn = false;
              return updatedUnits;
            }
          } else {
            const wallBetweenCombat = this.getWallBetween(lastFrom.x, lastFrom.y, target.x, target.y);
            if (wallBetweenCombat) {
              consumeTurn = false;
              return updatedUnits;
            }
          }
        }
        if (targetUnit.owner === movingUnit.owner) {
          // Merge Logic (Point-based Sum & Remainder) with 4-level tiers
          if (targetUnit.tier === movingUnit.tier) {
            const tier = targetUnit.tier;
            const sumPoints = this.calculateTotalPoints(movingUnit) + this.calculateTotalPoints(targetUnit);
            const thresholds: Record<number, number[]> = {
              1: [1, 2, 3, 4],
              2: [5, 10, 15, 20],
              3: [25, 50, 75, 100],
              4: [125, 250, 375, 500]
            };
            const tierMax = thresholds[tier][3];
            if (sumPoints <= tierMax) {
              targetUnit.points = sumPoints;
              const tl = this.calculateTierAndLevel(targetUnit.points);
              targetUnit.tier = tl.tier;
              targetUnit.level = tl.level;
              updatedUnits.splice(unitIndex, 1);
            } else {
              const nextTier = Math.min(4, tier + 1);
              const nextTierLevel1Cost = thresholds[nextTier][0];
              targetUnit.points = nextTierLevel1Cost;
              const tlTarget = this.calculateTierAndLevel(targetUnit.points);
              targetUnit.tier = tlTarget.tier;
              targetUnit.level = tlTarget.level;
              const remainderPoints = sumPoints - nextTierLevel1Cost;
              if (remainderPoints > 0) {
                movingUnit.points = remainderPoints;
                const tlMove = this.calculateTierAndLevel(movingUnit.points);
                movingUnit.tier = tlMove.tier;
                movingUnit.level = tlMove.level;
                updatedUnits[unitIndex] = movingUnit;
                remainderId = movingUnit.id;
              } else {
                updatedUnits.splice(unitIndex, 1);
              }
            }
            merged = true;
          } else {
            return updatedUnits; // blocked by isValidMove; safety
          }
        } else {
            if (movingUnit.owner === 'player' || this.gridSize <= 20) {
              this.attackerNudgeSignal.set({ id: movingUnit.id, dx: stepX * 8, dy: stepY * 8 });
              setTimeout(() => this.attackerNudgeSignal.set(null), 150);
            }
            this.shakenUnitIdSignal.set(targetUnit.id);
            setTimeout(() => this.shakenUnitIdSignal.set(null), 200);
            const attackerBase = this.calculateTotalPoints(movingUnit);
            const luckObj = this.getAttackLuckModifier(movingUnit);
            const defenderBase = this.calculateTotalPoints(targetUnit);
            const defBonus = this.combat.getDefenseBonus(targetUnit, updatedUnits);
            const attackerPoints = Math.max(0, attackerBase + luckObj.delta);
            const defenderPoints = defenderBase + defBonus.bonus;

            const modifiersText = [...defBonus.tags, luckObj.tag ?? ''].filter(Boolean).join(', ') || 'None';
            const diff = attackerPoints - defenderPoints;
            const formulaText =
              `[Turn ${this.turnSignal()}] ${movingUnit.owner === 'player' ? 'Player' : 'AI'} T${movingUnit.tier}(L${movingUnit.level}) attacked ${targetUnit.owner === 'player' ? 'Player' : 'AI'} T${targetUnit.tier}(L${targetUnit.level}). ` +
              `Power: ${attackerBase} vs ${defenderBase}. ` +
              `Modifiers: ${modifiersText}. ` +
              `Final: (${attackerBase}${luckObj.delta !== 0 ? (luckObj.delta > 0 ? `+${luckObj.delta}` : `${luckObj.delta}`) : ''}${defBonus.bonus > 0 ? ` - ${defBonus.bonus}` : ''}) - ${defenderBase} = ${diff}.`;
            this.log.addCombat(movingUnit.owner, formulaText, !!luckObj.isCrit);

            if (attackerPoints < defenderPoints) {
              this.queueCombatText('WEAK!', target);
            }

            if (attackerPoints > defenderPoints) {
              const newPoints = attackerPoints - defenderPoints;
              const { tier, level } = this.calculateTierAndLevel(newPoints);
              
              movingUnit.points = newPoints;
              movingUnit.tier = tier;
              movingUnit.level = level;
              
              updatedUnits.splice(targetUnitIndex, 1); // Remove defender
              if (luckObj.tag) {
                this.queueCombatText(luckObj.tag.startsWith('CRIT') ? 'CRIT!' : 'MISS!', target);
              }
              // movingUnit moves to target (below)
            } else if (attackerPoints < defenderPoints) {
              const newPoints = defenderPoints - attackerPoints;
              const { tier, level } = this.calculateTierAndLevel(newPoints);
              
              const defender = { ...targetUnit, points: newPoints, tier, level };
              updatedUnits[targetUnitIndex] = defender;
              updatedUnits.splice(unitIndex, 1); // Remove attacker
              return updatedUnits;
            } else {
              const coin = Math.random() < 0.5;
              if (coin) {
                this.queueCombatText('DRAW', target);
                this.log.addCombat(movingUnit.owner, `[Turn ${this.turnSignal()}] Result: DRAW - Both units destroyed.`, false);
                return updatedUnits.filter(u => u.id !== movingUnit.id && u.id !== targetUnit.id);
              } else {
                const survivorIsAttacker = Math.random() < 0.5;
                this.queueCombatText('LUCKY! (x1.25)', target);
                if (survivorIsAttacker) {
                  const baseMin = this.getPointsForTierLevel(movingUnit.tier, 1);
                  movingUnit.points = baseMin;
                  const tl = this.calculateTierAndLevel(baseMin);
                  movingUnit.tier = tl.tier;
                  movingUnit.level = tl.level;
                  updatedUnits.splice(targetUnitIndex, 1);
                  this.pulseUnitIdSignal.set(movingUnit.id);
                  setTimeout(() => this.pulseUnitIdSignal.set(null), 400);
                  this.log.addCombat(movingUnit.owner, `[Turn ${this.turnSignal()}] Result: LUCKY (x1.25) - Attacker survived!`, false);
                } else {
                  const baseMin = this.getPointsForTierLevel(targetUnit.tier, 1);
                  const defender = { ...targetUnit, points: baseMin };
                  const tl = this.calculateTierAndLevel(baseMin);
                  defender.tier = tl.tier;
                  defender.level = tl.level;
                  updatedUnits[targetUnitIndex] = defender;
                  updatedUnits.splice(unitIndex, 1);
                  this.pulseUnitIdSignal.set(defender.id);
                  setTimeout(() => this.pulseUnitIdSignal.set(null), 400);
                  this.log.addCombat(movingUnit.owner, `[Turn ${this.turnSignal()}] Result: LUCKY (x1.25) - Defender survived!`, false);
                  this.queueCombatText('LUCKY DEFENSE!', target);
                  return updatedUnits;
                }
              }
            }
        }
      }

      // If moving unit wasn't removed (simple merge or defeat) or turned into remainder
      if (updatedUnits.find(u => u.id === movingUnit.id)) {
          // If it became a remainder, it shouldn't move. 
          // Check if remainderId is set.
          if (remainderId === movingUnit.id) {
             // Do not update position, it stays behind.
          } else {
             movingUnit.position = target;
             movingUnit.turnsStationary = 0;
             // Update the unit in the array
             const idx = updatedUnits.findIndex(u => u.id === movingUnit.id);
             if (idx !== -1) updatedUnits[idx] = movingUnit;
             const next = new Set(this.movedThisTurnSignal());
             next.add(movingUnit.id);
             this.movedThisTurnSignal.set(next);
             this.lastArrivedUnitIdSignal.set(movingUnit.id);
             setTimeout(() => this.lastArrivedUnitIdSignal.set(null), 250);
             const map = new Map(this.unitMoveHistorySignal());
             const hist = map.get(movingUnit.id) ?? [];
             const startKey = { x: start.x, y: start.y };
             const targetKey = { x: target.x, y: target.y };
             const updatedHist = [...hist, startKey, targetKey].slice(-4);
             map.set(movingUnit.id, updatedHist);
             this.unitMoveHistorySignal.set(map);
          }
      }
      
      return updatedUnits;
    });

    if (merged) {
      // For simple merge, the moving unit is gone, so we highlight target?
      // Actually lastMergedUnitId usually highlights the result.
      // In simple merge, targetUnit is the result.
      // In remainder merge, targetUnit is the result (evolved), movingUnit is remainder.
      
      // We need to know which unit is the "result" of the merge to highlight it.
      // In both cases, targetUnit is the one growing/evolving.
      // But we don't have targetUnit ref here easily after update.
      // Let's find unit at target position.
      const resultUnit = this.getUnitAt(target.x, target.y);
      if (resultUnit) {
          this.lastMergedUnitIdSignal.set(resultUnit.id);
          setTimeout(() => this.lastMergedUnitIdSignal.set(null), 300);
      }
      
      if (remainderId) {
          this.lastRemainderUnitIdSignal.set(remainderId);
          setTimeout(() => this.lastRemainderUnitIdSignal.set(null), 300);
      }
    }

    this.checkBaseDefeat();
    
    if (this.gameStatus() === 'playing' && consumeTurn) {
      const isAi = unit.owner === 'ai';
      if (isAi) {
        const last = this.lastAiMovedUnitIdSignal();
        if (last === unit.id) {
          this.aiConsecMovesSignal.update(c => c + 1);
        } else {
          this.lastAiMovedUnitIdSignal.set(unit.id);
          this.aiConsecMovesSignal.set(1);
        }
        const hist = new Map(this.unitMoveHistorySignal()).get(unit.id) ?? [];
        const stutter = hist.length >= 4 &&
          hist[0].x === hist[2].x && hist[0].y === hist[2].y &&
          hist[1].x === hist[3].x && hist[1].y === hist[3].y &&
          (hist[0].x !== hist[1].x || hist[0].y !== hist[1].y);
        if (stutter) {
          const ban = new Map(this.unitStutterBanSignal());
          const tiles = new Set<string>([
            `${hist[0].x},${hist[0].y}`,
            `${hist[1].x},${hist[1].y}`
          ]);
          ban.set(unit.id, { tiles, until: this.turnSignal() + 5 });
          this.unitStutterBanSignal.set(ban);
          const center = { x: Math.floor(this.gridSize / 2), y: Math.floor(this.gridSize / 2) };
          const currQuadrant = this.getQuadrant(unit.position, center);
          const opposite = (currQuadrant + 2) % 4;
          const biasMap = new Map(this.unitQuadrantBiasSignal());
          biasMap.set(unit.id, { quadrant: opposite, until: this.turnSignal() + 5 });
          this.unitQuadrantBiasSignal.set(biasMap);
        }
      }
      if (!isAi || !this.aiBatchingActions) {
        this.endTurn();
      }
    }
  }

  // --- Helper Methods ---
  
  private calculateTotalPoints(unit: Unit): number {
    return this.combat.calculateTotalPoints(unit);
  }
 
  private calculateTierAndLevel(points: number): { tier: number, level: number } {
    return this.combat.calculateTierAndLevel(points);
  }
 
  private getPointsForTierLevel(tier: number, level: number): number {
    return this.combat.getPointsForTierLevel(tier, level);
  }
 
  
  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
  }
  
  private recomputeVisibility() {
    const res = this.map.computeVisibility(this.gridSize, this.unitsSignal(), this.getBasePosition('player'), this.getBasePosition('ai'), this.fogDebugDisabledSignal());
    this.playerVisibilitySignal.set(res.player);
    this.aiVisibilitySignal.set(res.ai);
    this.playerExploredSignal.update(prev => this.map.mergeExplored(prev, res.player));
    this.aiExploredSignal.update(prev => this.map.mergeExplored(prev, res.ai));
  }
  
  isVisibleToPlayer(x: number, y: number): boolean {
    if (this.fogDebugDisabledSignal()) return true;
    return this.playerVisibilitySignal().has(`${x},${y}`);
  }
  
  isVisibleToAi(x: number, y: number): boolean {
    if (this.fogDebugDisabledSignal()) return true;
    return this.aiVisibilitySignal().has(`${x},${y}`);
  }
  isExploredByPlayer(x: number, y: number): boolean {
    return this.playerExploredSignal().has(`${x},${y}`);
  }
  isExploredByAi(x: number, y: number): boolean {
    return this.aiExploredSignal().has(`${x},${y}`);
  }

  private calculatePower(unit: Unit): number {
      return this.calculateTotalPoints(unit);
  }

  private checkBaseDefeat() {
    const hp = this.baseHealthSignal();
    if (hp.ai <= 0) {
      this.gameStatusSignal.set('player wins');
      this.screenShakeSignal.set(true);
      setTimeout(() => {
        this.screenShakeSignal.set(false);
        this.endOverlaySignal.set(true);
      }, 1000);
      const aiBase = this.getBasePosition('ai');
      this.queueCombatText('💥', aiBase);
    } else if (hp.player <= 0) {
      this.gameStatusSignal.set('ai wins');
      this.screenShakeSignal.set(true);
      setTimeout(() => {
        this.screenShakeSignal.set(false);
        this.endOverlaySignal.set(true);
      }, 1000);
      const playerBase = this.getBasePosition('player');
      this.queueCombatText('💥', playerBase);
    }
  }

  private getDefenseBonus(unit: Unit): number {
    return this.combat.getDefenseBonus(unit, this.unitsSignal()).bonus;
  }

  private combatTextsSignal = signal<{ id: string; text: string; position: Position; opacity: number }[]>([]);
  readonly combatTexts = this.combatTextsSignal.asReadonly();
  defenseBonus(unit: Unit): number {
    return this.getDefenseBonus(unit);
  }
  hasDefenseBonus(unit: Unit): boolean {
    return this.getDefenseBonus(unit) > 0;
  }
  getNudgeFor(unitId: string): { dx: number; dy: number } | null {
    const n = this.attackerNudgeSignal();
    return n && n.id === unitId ? { dx: n.dx, dy: n.dy } : null;
  }
  isUnitShaking(id: string): boolean {
    return this.shakenUnitIdSignal() === id;
  }
  isWallShaking(id: string): boolean {
    return this.shakenWallIdSignal() === id;
  }
  screenShake(): boolean {
    return this.screenShakeSignal();
  }
  shouldShowEndOverlay(): boolean {
    return this.endOverlaySignal();
  }
  endReason(): string | null {
    return this.endReasonSignal();
  }
  isLuckyText(text: string): boolean {
    return text.startsWith('LUCKY');
  }
  isDrawText(text: string): boolean {
    return text === 'DRAW';
  }
  toggleCombatOnly() {
    this.combatOnlySignal.update(v => !v);
  }
  combatOnly(): boolean {
    return this.combatOnlySignal();
  }
  logsFiltered() {
    return this.log.logs().filter(e => !this.combatOnlySignal() || e.type === 'combat');
  }
  aiWood(): number {
    return this.aiWoodSignal();
  }
  monopolyCounter() {
    return this.forestMonopolySignal();
  }
  private getLuckDeltaForTier(tier: number): number {
    const values: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8 };
    return values[tier] ?? 0;
  }
  setHoveredUnit(id: string | null) {
    this.hoveredUnitIdSignal.set(id);
  }
  getHoverInfo(id: string): { atkMin: number; atkMax: number; hp: number; support: number } | null {
    const u = this.unitsSignal().find(x => x.id === id);
    if (!u) return null;
    const base = this.calculateTotalPoints(u);
    const luck = this.getLuckDeltaForTier(u.tier);
    const def = this.getDefenseBonus(u);
    return { atkMin: Math.max(0, base - luck), atkMax: base + luck, hp: u.points, support: def };
  }
  shouldRenderWall(tile1: Position, tile2: Position, owner?: Owner): boolean {
    const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
    if (!wall) return false;
    const ow = owner ?? wall.owner;
    if (ow === 'player') return true;
    if (this.fogDebugDisabledSignal()) return true;
    return this.isVisibleToPlayer(tile1.x, tile1.y) || this.isVisibleToPlayer(tile2.x, tile2.y);
  }
  getCombatTextEntriesAt(x: number, y: number): { id: string; text: string; opacity: number }[] {
    return this.combatTextsSignal()
      .filter(e => e.position.x === x && e.position.y === y)
      .map(e => ({ id: e.id, text: e.text, opacity: e.opacity }));
  }
  formatHoverInfo(id: string): string {
    const h = this.getHoverInfo(id);
    if (!h) return '';
    const u = this.unitsSignal().find(x => x.id === id);
    if (!u) return '';
    const maxHp = this.combat.getPointsForTierLevel(u.tier, 4);
    const def = h.support > 0 ? `+${h.support}` : '+0';
    return `Unit T${u.tier} | HP: ${h.hp}/${maxHp} | ATK: ${h.atkMin}-${h.atkMax} | DEF: ${def}`;
  }

  private getAttackLuckModifier(unit: Unit): { delta: number; tag?: string; isCrit?: boolean } {
    return this.combat.getAttackLuckModifier(unit);
  }

  private queueCombatText(text: string, position: Position) {
    const id = crypto.randomUUID();
    const entry = { id, text, position: { ...position }, opacity: 1 };
    // Single Text Rule: replace any existing text at this tile
    this.combatTextsSignal.update(arr => [...arr.filter(e => !(e.position.x === position.x && e.position.y === position.y)), entry]);
    setTimeout(() => {
      this.combatTextsSignal.update(arr => arr.map(e => (e.id === id ? { ...e, opacity: 0 } : e)));
    }, 1500);
    setTimeout(() => {
      this.combatTextsSignal.update(arr => arr.filter(e => e.id !== id));
    }, 2000);
  }

  private calculateValidMoves(unit: Unit): Position[] {
    const moves: Position[] = [];
    
    // Tier 1: 1 tile X/Y
    // Tier 2: 1 tile 8-dir
    // Tier 3: 2 tiles 8-dir
    // Tier 4: 3 tiles 8-dir
    
    const range = unit.tier >= 3 ? (unit.tier === 4 ? 3 : 2) : 1;
    const diagonals = unit.tier >= 2;

    const directions = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
    ];
    if (diagonals) {
        directions.push({ x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 });
    }

    // BFS or just iterate directions * range?
    // "Moves up to X tiles". Assuming jumping over isn't allowed? Or is it just range?
    // Usually "Move 2 tiles" means walking distance.
    // Let's implement pathfinding style reachability or just simple "Line of Sight" movement?
    // "Moves up to X tiles" in grid usually implies walking.
    // However, for simplicity and standard tactics, let's assume it can stop at any tile within range in those directions, 
    // BLOCKED by obstacles.
    
    for (const dir of directions) {
      for (let i = 1; i <= range; i++) {
        const newPos = {
          x: unit.position.x + dir.x * i,
          y: unit.position.y + dir.y * i
        };

        if (newPos.x >= 0 && newPos.x < this.gridSize && newPos.y >= 0 && newPos.y < this.gridSize) {
          const from = {
            x: unit.position.x + dir.x * (i - 1),
            y: unit.position.y + dir.y * (i - 1)
          };
          if (dir.x !== 0 && dir.y !== 0) {
            if (this.isDiagonalBlocked(from, newPos)) {
              break;
            }
          } else {
            const wall = this.getWallBetween(from.x, from.y, newPos.x, newPos.y);
            if (wall) {
              break;
            }
          }

          const targetUnit = this.getUnitAt(newPos.x, newPos.y);

          if (!targetUnit) {
            moves.push(newPos);
          } else {
            if (targetUnit.owner === unit.owner) {
              if (targetUnit.tier === unit.tier) {
                moves.push(newPos);
              }
            } else {
              moves.push(newPos);
            }
            break;
          }
        } else {
          break;
        }
      }
    }
    return moves;
  }

  // --- Turn Management ---

  private endTurn() {
    this.selectedUnitIdSignal.set(null); 
    const ownerJustActed: Owner = this.activeSideSignal();
    // Update stationary counters based on who just acted
    const movedIds = new Set(this.movedThisTurnSignal());
    this.unitsSignal.update(units =>
      units.map(u => {
        if (u.owner !== ownerJustActed) return u;
        const moved = movedIds.has(u.id);
        const onForest = this.isForest(u.position.x, u.position.y);
        const occ = onForest
          ? (moved ? 1 : (u.forestOccupationTurns ?? 0) + 1)
          : (moved ? 0 : 0);
        const active = onForest ? occ >= 3 : false;
        return {
          ...u,
          turnsStationary: moved ? 0 : (u.turnsStationary ?? 0) + 1,
          forestOccupationTurns: occ,
          productionActive: active
        };
      })
    );
    this.movedThisTurnSignal.set(new Set<string>());
    this.wallBuiltThisTurnSignal.set(false);

    if (this.gameStatus() === 'playing') {
      const countOnForest = this.unitsSignal().filter(u => u.owner === ownerJustActed && this.isForest(u.position.x, u.position.y) && (u.productionActive ?? false)).length;
      if (countOnForest > 0) {
        if (ownerJustActed === 'player') {
          this.resourcesSignal.update(r => ({ wood: r.wood + countOnForest * 2 }));
        } else {
          this.aiWoodSignal.update(w => w + countOnForest * 2);
        }
      }
    }
    this.deployTargetsSignal.set([]);
    this.baseDeployActiveSignal.set(false);
    this.recomputeVisibility();
    if (ownerJustActed === 'player' && this.gameStatus() === 'playing') {
      this.updateForestMonopoly();
    }
    // Switch phase; when player finishes, increment turn and add reserves
    const nextSide: Owner = ownerJustActed === 'player' ? 'ai' : 'player';
    if (ownerJustActed === 'player') {
      this.turnSignal.update(t => t + 1);
      const aiBonus = this.settings.getAiReserveBonus();
      this.reservePointsSignal.update(r => ({ player: r.player + 1, ai: r.ai + aiBonus }));
    } else {
      if (this.autoDeployEnabledSignal() && this.playerConvertedThisTurnSignal() && this.reservePointsSignal().player > 0) {
        this.autoDeployFromReserves();
        this.playerConvertedThisTurnSignal.set(false);
      }
    }
    this.activeSideSignal.set(nextSide);
    if (nextSide === 'ai' && this.gameStatus() === 'playing') {
      setTimeout(() => this.aiTurn(), 10);
    }
  }
  private updateForestMonopoly() {
    const total = this.forestsSignal().length;
    if (total === 0) {
      this.forestMonopolySignal.set({ player: 0, ai: 0 });
      return;
    }
    const playerHeld = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y)).length;
    const aiHeld = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
    if (playerHeld === total) {
      const next = { ...this.forestMonopolySignal() };
      next.player = next.player + 1;
      next.ai = 0;
      this.forestMonopolySignal.set(next);
      // removed non-combat log
      if (next.player >= 10) {
        this.gameStatusSignal.set('player wins');
        this.screenShakeSignal.set(true);
        this.endReasonSignal.set('ECONOMIC DOMINATION! All forests held for 10 turns.');
        setTimeout(() => {
          this.screenShakeSignal.set(false);
          this.endOverlaySignal.set(true);
        }, 1000);
      }
    } else if (aiHeld === total) {
      const next = { ...this.forestMonopolySignal() };
      next.ai = next.ai + 1;
      next.player = 0;
      this.forestMonopolySignal.set(next);
      // removed non-combat log
      if (next.ai >= 10) {
        this.gameStatusSignal.set('ai wins');
        this.screenShakeSignal.set(true);
        this.endReasonSignal.set('ECONOMIC DOMINATION! All forests held for 10 turns.');
        setTimeout(() => {
          this.screenShakeSignal.set(false);
          this.endOverlaySignal.set(true);
        }, 1000);
      }
    } else {
      this.forestMonopolySignal.set({ player: 0, ai: 0 });
    }
  }

  // --- AI Logic ---

  private async aiTurn() {
    if (this.activeSideSignal() !== 'ai' || this.gameStatus() !== 'playing') return;
    if (this.isAiThinking) return;
    this.isAiThinking = true;
    console.trace('AI TURN START TRACE');
    this.aiBatchingActions = true;
    const aiBase = this.getBasePosition('ai');
    console.log('[AI] Phase: Economy');
    while (this.aiWoodSignal() >= 20) {
      this.aiConvertWoodToReserve();
    }
    await new Promise(r => setTimeout(r, 100));
    const currentAiUnits = this.unitsSignal().filter(u => u.owner === 'ai');
    const timeMap = new Map(this.aiUnitTimeNearBaseSignal());
    const currentIds = new Set(currentAiUnits.map(u => u.id));
    for (const id of timeMap.keys()) {
      if (!currentIds.has(id)) timeMap.delete(id);
    }
    for (const unit of currentAiUnits) {
      const dist = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y));
      if (dist <= 3) timeMap.set(unit.id, (timeMap.get(unit.id) || 0) + 1);
      else timeMap.set(unit.id, 0);
    }
    this.aiUnitTimeNearBaseSignal.set(timeMap);
    const playerIncome = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y) && (u.productionActive ?? false)).length * 2;
    const aiIncome = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y) && (u.productionActive ?? false)).length * 2;
    const aggression = playerIncome >= aiIncome;
    this.aggressionModeSignal.set(aggression);
    console.log(`[AI Economy] Player Income: ${playerIncome}, AI Income: ${aiIncome}. AGGRESSION MODE: ${aggression}`);
    const threats2 = this.unitsSignal().filter(u => u.owner === 'player' && Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 2);
    if (threats2.length > 0) {
      const highest = threats2.reduce((acc, e) => this.calculateTotalPoints(e) > this.calculateTotalPoints(acc) ? e : acc, threats2[0]);
      this.aiDefenseSpawn(highest);
    }
    if (!this.wallBuiltThisTurnSignal()) {
      this.tryDefensiveWallsNearForests();
    }
    console.log('[AI] Phase: Expansion');
    const decision = this.aiStrategy.chooseBestEndingAction(this);
    const aiForestCount = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
    const enemyNearBase = this.unitsSignal().some(u => u.owner === 'player' && Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3);
    const reserves = this.reservePointsSignal().ai;
    const blocked = new Set<string>();
    if (decision && Math.max(Math.abs(decision.target.x - aiBase.x), Math.abs(decision.target.y - aiBase.y)) <= 2) {
      blocked.add(`${decision.target.x},${decision.target.y}`);
    }
    const opening = this.turnSignal() <= 3;
    const banT1 = this.turnSignal() > 8 && !enemyNearBase;
    if (banT1) {
      console.log('[AI Spawn] Turn > 8. Refusing to spawn T1. Saving for T3/T4.');
    }
    if (opening && aiForestCount < 3) {
      this.aiSpawnTier(1, 2, blocked);
    } else {
      const playerUnits = this.unitsSignal().filter(u => u.owner === 'player');
      const forestsAll = this.forestsSignal();
      const threatEnemies = playerUnits.filter(p => {
        const nearBase = Math.max(Math.abs(p.position.x - aiBase.x), Math.abs(p.position.y - aiBase.y)) <= 3;
        const nearForest = forestsAll.some(f => Math.max(Math.abs(p.position.x - f.x), Math.abs(p.position.y - f.y)) <= 3);
        return nearBase || nearForest;
      });
      if (threatEnemies.length > 0) {
        const maxTier = Math.max(...threatEnemies.map(e => e.tier));
        const desiredTier = Math.min(4, maxTier + 1);
        const requiredCost = this.getPointsForTierLevel(desiredTier, 1);
        while (this.aiWoodSignal() >= 20 && this.reservePointsSignal().ai < requiredCost) {
          this.aiConvertWoodToReserve();
        }
        if (this.reservePointsSignal().ai >= requiredCost) {
          this.aiSpawnTier(desiredTier, 1, blocked);
        }
      } else {
        const t4Cost = this.getPointsForTierLevel(4, 1);
        const t3Cost = this.getPointsForTierLevel(3, 1);
        if (reserves >= t4Cost) {
          this.aiSpawnTier(4, 1, blocked);
        } else if (reserves >= t3Cost) {
          this.aiSpawnTier(3, 1, blocked);
        }
      }
    }
    if (decision) {
      const movedSet = new Set(this.movedThisTurnSignal());
      if (movedSet.has(decision.unit.id)) {
        console.log('[AI] Decision rejected: unit already moved this turn');
        this.endTurn();
        console.log('--- AI TURN FINISHED, WAITING FOR PLAYER ---');
        this.isAiThinking = false;
        this.aiBatchingActions = false;
        return;
      }
      const tag = decision.reason;
      const kind = decision.reason.includes('Attack') ? 'Move/Attack' : (decision.reason.includes('Merge') ? 'Merge' : 'Move');
      console.log(`[AI] Phase: ${kind} (${tag})`);
      this.executeMove(decision.unit, decision.target);
    }
    console.log('>>> SWITCHING TO PLAYER SIDE NOW <<<');
    this.endTurn();
    console.log('--- AI TURN FINISHED, WAITING FOR PLAYER ---');
    this.isAiThinking = false;
    this.aiBatchingActions = false;
    return;
  }
  private aiDefenseSpawn(threat: Unit) {
    const aiBase = this.getBasePosition('ai');
    const stepX = Math.sign(threat.position.x - aiBase.x);
    const stepY = Math.sign(threat.position.y - aiBase.y);
    const candidates: Position[] = [];
    const first: Position = { x: aiBase.x + (Math.abs(stepX) === 1 ? stepX : 0), y: aiBase.y + (Math.abs(stepY) === 1 ? stepY : 0) };
    const alt: Position[] = [
      { x: aiBase.x + stepX, y: aiBase.y },
      { x: aiBase.x, y: aiBase.y + stepY }
    ];
    if (this.inBounds(first.x, first.y)) candidates.push(first);
    for (const p of alt) if (this.inBounds(p.x, p.y)) candidates.push(p);
    const open = candidates.find(p => !this.getUnitAt(p.x, p.y));
    const desiredTier = Math.min(4, threat.tier + 1);
    const cost = this.getPointsForTierLevel(desiredTier, 1);
    while (this.aiWoodSignal() >= 20 && this.reservePointsSignal().ai < cost) this.aiConvertWoodToReserve();
    if (this.reservePointsSignal().ai < cost) return;
    if (open) {
      const tl = this.calculateTierAndLevel(cost);
      this.unitsSignal.update(units => [...units, { id: crypto.randomUUID(), position: { ...open }, level: tl.level, tier: tl.tier, points: cost, owner: 'ai', turnsStationary: 0, forestOccupationTurns: 0, productionActive: false }]);
      this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai - cost }));
      this.recomputeVisibility();
      console.log('[AI Defense] Spawned blocker at', open);
      return;
    }
    this.aiSpawnTier(desiredTier, 1, new Set<string>());
  }

  // --- Spawning ---

  private aiReserveDump() {
    const aiBase = this.getBasePosition('ai');
    const info = this.economy.computeAiReserveDump(this.gridSize, aiBase, this.reservePointsSignal().ai, (x, y) => this.getUnitAt(x, y) || null);
    if (info.created.length > 0) {
      this.unitsSignal.update(units => [...units, ...info.created]);
      this.reservePointsSignal.update(r => ({ player: r.player, ai: info.remaining }));
      this.recomputeVisibility();
      console.log(`[AI Spawn] Created ${info.created.length} units via Reserve Dump.`);
    } else if (this.reservePointsSignal().ai > 0) {
      console.log(`[AI Spawn] Failed to spawn despite having ${this.reservePointsSignal().ai} reserves. Base congested?`);
    }
  }
  private aiLimitedSpawn(maxCount: number, blocked: Set<string>) {
    const base = this.getBasePosition('ai');
    const candidates: Position[] = [];
    const radius = 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = base.x + dx;
        const y = base.y + dy;
        if (!this.inBounds(x, y)) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
        const key = `${x},${y}`;
        if (blocked.has(key)) continue;
        if (!this.getUnitAt(x, y)) candidates.push({ x, y });
      }
    }
    let reserves = this.reservePointsSignal().ai;
    let created = 0;
    const placed: Unit[] = [];
    const posUsed = new Set<string>();
    for (const pos of candidates) {
      if (created >= maxCount) break;
      if (reserves <= 0) break;
      const cost = this.economy.getHighestAffordableCost(reserves);
      if (cost <= 0) break;
      const tl = this.calculateTierAndLevel(cost);
      const key = `${pos.x},${pos.y}`;
      if (posUsed.has(key)) continue;
      placed.push({ id: crypto.randomUUID(), position: { ...pos }, level: tl.level, tier: tl.tier, points: cost, owner: 'ai', turnsStationary: 0, forestOccupationTurns: 0, productionActive: false });
      reserves -= cost;
      created++;
      posUsed.add(key);
    }
    if (placed.length > 0) {
      this.unitsSignal.update(units => [...units, ...placed]);
      this.reservePointsSignal.update(r => ({ player: r.player, ai: reserves }));
      this.recomputeVisibility();
      console.log(`[AI Spawn] Created ${placed.length} unit(s) with limited spawning.`);
    } else if (this.reservePointsSignal().ai > 0) {
      console.log(`[AI Spawn] No valid tiles for limited spawn. Possibly congested or blocked by merge.`);
    }
    return created;
  }
  private aiSpawnTier(tier: number, maxCount: number, blocked: Set<string>) {
    const base = this.getBasePosition('ai');
    const candidates: Position[] = [];
    const radius = 2;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = base.x + dx;
        const y = base.y + dy;
        if (!this.inBounds(x, y)) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
        const key = `${x},${y}`;
        if (blocked.has(key)) continue;
        if (!this.getUnitAt(x, y)) candidates.push({ x, y });
      }
    }
    let reserves = this.reservePointsSignal().ai;
    const cost = this.getPointsForTierLevel(tier, 1);
    let created = 0;
    const placed: Unit[] = [];
    for (const pos of candidates) {
      if (created >= maxCount) break;
      if (reserves < cost) break;
      const tl = this.calculateTierAndLevel(cost);
      placed.push({ id: crypto.randomUUID(), position: { ...pos }, level: tl.level, tier: tl.tier, points: cost, owner: 'ai', turnsStationary: 0, forestOccupationTurns: 0, productionActive: false });
      reserves -= cost;
      created++;
    }
    if (placed.length > 0) {
      this.unitsSignal.update(units => [...units, ...placed]);
      this.reservePointsSignal.update(r => ({ player: r.player, ai: reserves }));
      this.recomputeVisibility();
      console.log(`[AI Spawn] Created ${placed.length} unit(s) of T${tier}.`);
    }
    return created;
  }
  private aiConvertWoodToReserve() {
    const w = this.aiWoodSignal();
    if (w < 20) return;
    this.aiWoodSignal.update(x => x - 20);
    this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai + 1 }));
  }
  spawnUnit(owner: Owner) {
    const basePosition: Position = this.getBasePosition(owner);
    this.unitsSignal.update(units => {
      const occupied = units.some(u => u.position.x === basePosition.x && u.position.y === basePosition.y);
      if (occupied) return units;
      const newUnit: Unit = { id: crypto.randomUUID(), position: { ...basePosition }, level: 1, tier: 1, points: 1, owner, turnsStationary: 0, forestOccupationTurns: 0, productionActive: false };
      return [...units, newUnit];
    });
  }
 
  private spawnStarterArmy(owner: Owner) {
    const base = this.getBasePosition(owner);
    const radius = 2;
    const candidates: Position[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = base.x + dx;
        const y = base.y + dy;
        if (!this.inBounds(x, y)) continue;
        if (dx === 0 && dy === 0) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > radius) continue;
        candidates.push({ x, y });
      }
    }
    const unitsToCreate = [
      { tier: 3, level: 1 },
      { tier: 2, level: 1 },
      { tier: 1, level: 1 }
    ];
    const newUnits: Unit[] = [];
    const occupied = (x: number, y: number) =>
      this.unitsSignal().some(u => u.position.x === x && u.position.y === y) ||
      newUnits.some(u => u.position.x === x && u.position.y === y);
    for (const cfg of unitsToCreate) {
      const available = candidates.filter(p => !occupied(p.x, p.y));
      if (available.length === 0) break;
      const idx = Math.floor(Math.random() * available.length);
      const pos = available[idx];
      const points = this.getPointsForTierLevel(cfg.tier, cfg.level);
      newUnits.push({
        id: crypto.randomUUID(),
        position: { ...pos },
        level: cfg.level,
        tier: cfg.tier,
        points,
        owner,
        turnsStationary: 0
      });
    }
    if (newUnits.length > 0) {
      this.unitsSignal.update(units => [...units, ...newUnits]);
    }
  }

  getUnitAt(x: number, y: number): Unit | undefined {
    return this.unitsSignal().find(u => u.position.x === x && u.position.y === y);
  }
  getWallBetween(x1: number, y1: number, x2: number, y2: number): Wall | undefined {
    const p1: Position = { x: x1, y: y1 };
    const p2: Position = { x: x2, y: y2 };
    if (!this.areAdjacent(p1, p2)) return undefined;
    const [a, b] = this.sortEdgeEndpoints(p1, p2);
    return this.wallsSignal().find(
      w =>
        w.tile1.x === a.x &&
        w.tile1.y === a.y &&
        w.tile2.x === b.x &&
        w.tile2.y === b.y
    );
  }
 
  private isDiagonalBlocked(from: Position, to: Position): boolean {
    return this.combat.isDiagonalBlocked(from, to, (x1, y1, x2, y2) => this.getWallBetween(x1, y1, x2, y2));
  }
 
  isValidMove(x: number, y: number): boolean {
      return this.validMoves().some(p => p.x === x && p.y === y);
  }

  isForest(x: number, y: number): boolean {
    return this.forestsSignal().some(p => p.x === x && p.y === y);
  }

  private generateForests(): Position[] {
    const total = this.gridSize * this.gridSize;
    const count = Math.max(1, Math.floor(total * 0.1));
    const positions: Position[] = [];
    const playerBase = this.getBasePosition('player');
    const aiBase = this.getBasePosition('ai');
    const inSpawnSafeZone = (x: number, y: number) => {
      const dPlayer = Math.max(Math.abs(x - playerBase.x), Math.abs(y - playerBase.y));
      const dAi = Math.max(Math.abs(x - aiBase.x), Math.abs(y - aiBase.y));
      return dPlayer <= 3 || dAi <= 3;
    };
    while (positions.length < count) {
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);
      if (inSpawnSafeZone(x, y)) continue;
      if (positions.some(p => p.x === x && p.y === y)) continue;
      positions.push({ x, y });
    }
    return positions;
  }

  getBasePosition(owner: Owner): Position {
    return owner === 'player' ? { x: 0, y: 0 } : { x: this.gridSize - 1, y: this.gridSize - 1 };
  }

  cancelDeploy() {
    this.deployTargetsSignal.set([]);
    this.baseDeployActiveSignal.set(false);
  }
 
  toggleBuildMode() {
    if (this.buildModeSignal()) {
      this.buildModeSignal.set(false);
      return;
    }
    if (!this.canBuildThisTurn()) return;
    this.buildModeSignal.set(true);
  }
 
  toggleFogDebug() {
    this.fogDebugDisabledSignal.update(v => !v);
  }
 
  toggleRules() {
    this.rulesOpenSignal.update(v => !v);
  }
 
  closeRules() {
    this.rulesOpenSignal.set(false);
  }
 
  toggleLog() {
    this.logsOpenSignal.update(v => !v);
  }
  logOpen() {
    return this.logsOpenSignal();
  }
  toggleSettings() {
    this.settingsOpenSignal.update(v => !v);
  }
  autoDeployEnabled(): boolean {
    return this.autoDeployEnabledSignal();
  }
  toggleAutoDeploy() {
    this.autoDeployEnabledSignal.update(v => !v);
  }
  settingsOpen() {
    return this.settingsOpenSignal();
  }
  logs() {
    return this.log.logs();
  }
  private appendLog(entry: string, color?: 'text-green-400' | 'text-red-400' | 'text-yellow-300' | 'text-gray-200') {
    this.log.add(entry, color);
  }

  buildWallBetween(tile1: Position, tile2: Position) {
    const wood = this.resourcesSignal().wood;
    if (wood < 10) return;
    if (!this.canBuildWallBetween(tile1, tile2)) return;
    if (!this.isAnyPlayerUnitAdjacentToEdge(tile1, tile2)) return;
    if (this.wallBuiltThisTurnSignal()) return;

    const [a, b] = this.sortEdgeEndpoints(tile1, tile2);
    this.wallsSignal.update(ws => [
      ...ws,
      {
        id: crypto.randomUUID(),
        tile1: { x: a.x, y: a.y },
        tile2: { x: b.x, y: b.y },
        health: 100,
        owner: 'player'
      }
    ]);
    this.resourcesSignal.update(r => ({ wood: r.wood - 10 }));
    this.buildModeSignal.set(false);
    this.wallBuiltThisTurnSignal.set(true);
  }
 
  convertWoodToReserve() {
    const wood = this.resourcesSignal().wood;
    if (wood < 20) return;
    this.resourcesSignal.update(r => ({ wood: r.wood - 20 }));
    this.reservePointsSignal.update(r => ({ player: r.player + 1, ai: r.ai }));
    this.playerConvertedThisTurnSignal.set(true);
  }
  maxConvertWoodToReserve() {
    const wood = this.resourcesSignal().wood;
    const count = Math.floor(wood / 20);
    if (count <= 0) return;
    this.resourcesSignal.update(r => ({ wood: r.wood - count * 20 }));
    this.reservePointsSignal.update(r => ({ player: r.player + count, ai: r.ai }));
    this.playerConvertedThisTurnSignal.set(true);
  }
  startDeployFromBase() {
    const reserves = this.reservePointsSignal().player;
    const base = this.getBasePosition('player');
    if (reserves <= 0) {
      this.deployTargetsSignal.set([]);
      this.baseDeployActiveSignal.set(false);
      return;
    }
    const targets: Position[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = base.x + dx;
        const y = base.y + dy;
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
        const occupiedUnit = this.getUnitAt(x, y);
        if (!occupiedUnit) targets.push({ x, y });
      }
    }
    this.deployTargetsSignal.set(targets);
    this.baseDeployActiveSignal.set(true);
  }
  private autoDeployFromReserves() {
    const base = this.getBasePosition('player');
    const candidates: Position[] = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = base.x + dx;
        const y = base.y + dy;
        if (!this.inBounds(x, y)) continue;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 2) continue;
        if (!this.getUnitAt(x, y)) candidates.push({ x, y });
      }
    }
    let reserves = this.reservePointsSignal().player;
    const placed: Position[] = [];
    for (const pos of candidates) {
      if (reserves <= 0) break;
      const cost = this.economy.getHighestAffordableCost(reserves);
      if (cost <= 0) break;
      const tl = this.calculateTierAndLevel(cost);
      this.unitsSignal.update(units => [...units, { id: crypto.randomUUID(), position: { ...pos }, level: tl.level, tier: tl.tier, points: cost, owner: 'player', turnsStationary: 0, forestOccupationTurns: 0, productionActive: false }]);
      reserves -= cost;
      placed.push(pos);
    }
    if (placed.length > 0) {
      this.reservePointsSignal.update(r => ({ player: reserves, ai: r.ai }));
      this.recomputeVisibility();
    }
  }

  isDeployTarget(x: number, y: number): boolean {
    return this.deployTargetsSignal().some(p => p.x === x && p.y === y);
  }

  deployTo(target: Position) {
    if (!this.isDeployTarget(target.x, target.y)) return;
    const reserves = this.reservePointsSignal().player;
    if (reserves <= 0) return;
    const cost = this.economy.getHighestAffordableCost(reserves);
    if (cost <= 0) return;
    const tl = this.calculateTierAndLevel(cost);
    this.unitsSignal.update(units => {
      const newUnit: Unit = { id: crypto.randomUUID(), position: { ...target }, level: tl.level, tier: tl.tier, points: cost, owner: 'player', turnsStationary: 0 };
      return [...units, newUnit];
    });
    this.reservePointsSignal.update(r => ({ player: r.player - cost, ai: r.ai }));
    this.deployTargetsSignal.set([]);
    this.baseDeployActiveSignal.set(false);
    this.recomputeVisibility();
    this.appendLog(`[Turn ${this.turnSignal()}] Player deployed T${tl.tier}(L${tl.level}) at (${target.x},${target.y}) costing ${cost} reserve.`);
  }

  private areAdjacent(a: Position, b: Position): boolean {
    return this.build.areAdjacent(a, b);
  }

  private sortEdgeEndpoints(a: Position, b: Position): [Position, Position] {
    return this.build.sortEdgeEndpoints(a, b);
  }

  attackOrDestroyWallBetween(tile1: Position, tile2: Position) {
    const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
    if (!wall) return;

    if (wall.owner === 'player') {
      this.destroyOwnWallBetween(tile1, tile2);
      return;
    }

    const unit = this.getBestAdjacentPlayerUnit(tile1, tile2);
    if (!unit) return;

    const dmgPercent = this.combat.getWallHitPercent(unit.tier);
    this.wallsSignal.update(ws =>
      ws
        .map(w =>
          w.id === wall.id
            ? { ...w, health: Math.max(0, w.health - dmgPercent) }
            : w
        )
        .filter(w => w.health > 0)
    );
    this.shakenWallIdSignal.set(wall.id);
    setTimeout(() => this.shakenWallIdSignal.set(null), 200);
    this.appendLog(`[Turn ${this.turnSignal()}] Player hit AI wall (${tile1.x},${tile1.y})-(${tile2.x},${tile2.y}) for ${dmgPercent}% damage.`);
    this.endTurn();
  }

  destroyOwnWallBetween(tile1: Position, tile2: Position) {
    const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
    if (!wall) return;
    if (wall.owner !== 'player') return;
    if (!this.isAnyPlayerUnitAdjacentToEdge(tile1, tile2)) return;
    this.wallsSignal.update(ws => ws.filter(w => w.id !== wall.id));
    this.appendLog(`[Turn ${this.turnSignal()}] Player removed own wall between (${tile1.x},${tile1.y})-(${tile2.x},${tile2.y}).`);
  }

  canDestroyOwnWall(tile1: Position, tile2: Position): boolean {
    const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
    if (!wall) return false;
    if (wall.owner !== 'player') return false;
    return this.isAnyPlayerUnitAdjacentToEdge(tile1, tile2);
  }

  canAttackEnemyWall(tile1: Position, tile2: Position): boolean {
    const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
    if (!wall) return false;
    if (wall.owner !== 'ai') return false;
    const unit = this.getBestAdjacentPlayerUnit(tile1, tile2);
    if (!unit) return false;
    return true;
  }

  canShowAttackIcon(tile1: Position, tile2: Position): boolean {
    const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
    if (!wall) return false;
    if (!this.canActThisTurn()) return false;
    if (wall.owner === 'player') {
      return this.canDestroyOwnWall(tile1, tile2);
    }
    return this.canAttackEnemyWall(tile1, tile2);
  }

  canBuildThisTurn(): boolean {
    if (!this.canActThisTurn()) return false;
    if (this.wallBuiltThisTurnSignal()) return false;
    return this.resourcesSignal().wood >= 10;
  }
 
  private canActThisTurn(): boolean {
    if (this.gameStatusSignal() !== 'playing') return false;
    return this.activeSideSignal() === 'player';
  }
 
  private isAnyPlayerUnitAdjacentToEdge(tile1: Position, tile2: Position): boolean {
    return this.unitsSignal().some(
      u =>
        u.owner === 'player' &&
        ((u.position.x === tile1.x && u.position.y === tile1.y) ||
          (u.position.x === tile2.x && u.position.y === tile2.y))
    );
  }
 
  private getAdjacentPlayerUnits(tile1: Position, tile2: Position): Unit[] {
    return this.unitsSignal().filter(
      u =>
        u.owner === 'player' &&
        ((u.position.x === tile1.x && u.position.y === tile1.y) ||
          (u.position.x === tile2.x && u.position.y === tile2.y))
    );
  }
 
  private getBestAdjacentPlayerUnit(tile1: Position, tile2: Position): Unit | null {
    const candidates = this.getAdjacentPlayerUnits(tile1, tile2);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, u) =>
      this.calculateTotalPoints(u) > this.calculateTotalPoints(best) ? u : best
    );
  }

  canShowBuildIcon(tile1: Position, tile2: Position): boolean {
    if (!this.buildModeSignal()) return false;
    if (!this.canBuildThisTurn()) return false;
    if (!this.canBuildWallBetween(tile1, tile2)) return false;
    return this.isAnyPlayerUnitAdjacentToEdge(tile1, tile2);
  }

  isInSafeZone(x: number, y: number): boolean {
    return this.isInNoBuildZone({ x, y });
  }

  canBuildWallBetween(tile1: Position, tile2: Position): boolean {
    if (!this.areAdjacent(tile1, tile2)) return false;
    if (!this.isVisibleToPlayer(tile1.x, tile1.y) && !this.isVisibleToPlayer(tile2.x, tile2.y)) return false;
    if (this.isInNoBuildZone(tile1) || this.isInNoBuildZone(tile2)) return false;
    if (!!this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y)) return false;
    return true;
  }

  private aiBuildWallBetween(tile1: Position, tile2: Position) {
    if (this.wallBuiltThisTurnSignal()) return;
    if (this.aiWoodSignal() < 10) return;
    if (!this.areAdjacent(tile1, tile2)) return;
    if (this.isInNoBuildZone(tile1) || this.isInNoBuildZone(tile2)) return;
    if (this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y)) return;
    if (this.wouldCageElite(tile1, tile2) && !this.isBaseProtectionEdge(tile1, tile2)) return;
    const adjacentAI = this.unitsSignal().some(
      u =>
        u.owner === 'ai' &&
        ((u.position.x === tile1.x && u.position.y === tile1.y) ||
          (u.position.x === tile2.x && u.position.y === tile2.y))
    );
    if (!adjacentAI) return;
    const [a, b] = this.sortEdgeEndpoints(tile1, tile2);
    this.wallsSignal.update(ws => [
      ...ws,
      {
        id: crypto.randomUUID(),
        tile1: { x: a.x, y: a.y },
        tile2: { x: b.x, y: b.y },
        health: 100,
        owner: 'ai'
      }
    ]);
    this.aiWoodSignal.update(w => w - 10);
    this.wallBuiltThisTurnSignal.set(true);
  }
  private isBaseProtectionEdge(tile1: Position, tile2: Position): boolean {
    const aiBase = this.getBasePosition('ai');
    const near = (p: Position) => Math.max(Math.abs(p.x - aiBase.x), Math.abs(p.y - aiBase.y)) <= 1 || (p.x === aiBase.x && p.y === aiBase.y);
    return near(tile1) || near(tile2);
  }
  private wouldCageElite(tile1: Position, tile2: Position): boolean {
    const extraEdge = (x1: number, y1: number, x2: number, y2: number) => {
      const a = this.sortEdgeEndpoints({ x: x1, y: y1 }, { x: x2, y: y2 });
      const b = this.sortEdgeEndpoints(tile1, tile2);
      return a[0].x === b[0].x && a[0].y === b[0].y && a[1].x === b[1].x && a[1].y === b[1].y;
    };
    const blocked = (from: Position, to: Position): boolean => {
      if (from.x === to.x || from.y === to.y) {
        const w = this.getWallBetween(from.x, from.y, to.x, to.y);
        if (w) return true;
        if (extraEdge(from.x, from.y, to.x, to.y)) return true;
        return false;
      } else {
        const sx = Math.sign(to.x - from.x);
        const sy = Math.sign(to.y - from.y);
        const w1 = this.getWallBetween(from.x, from.y, from.x + sx, from.y);
        const w2 = this.getWallBetween(from.x, from.y, from.x, from.y + sy);
        const w3 = this.getWallBetween(to.x - sx, to.y, to.x, to.y);
        const w4 = this.getWallBetween(to.x, to.y - sy, to.x, to.y);
        if (w1 || w2 || w3 || w4) return true;
        if (extraEdge(from.x, from.y, from.x + sx, from.y)) return true;
        if (extraEdge(from.x, from.y, from.x, from.y + sy)) return true;
        if (extraEdge(to.x - sx, to.y, to.x, to.y)) return true;
        if (extraEdge(to.x, to.y - sy, to.x, to.y)) return true;
        return false;
      }
    };
    const dirs: Position[] = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }
    ];
    for (const u of this.unitsSignal()) {
      if (u.owner !== 'ai') continue;
      if (u.tier < 2) continue;
      const allowed = dirs.filter(d => {
        const to = { x: u.position.x + d.x, y: u.position.y + d.y };
        if (!this.inBounds(to.x, to.y)) return false;
        return !blocked(u.position, to);
      });
      if (allowed.length < 2) return true;
    }
    return false;
  }
  private tryFarmerCage(): boolean {
    if (this.wallBuiltThisTurnSignal()) return false;
    const farmers = this.unitsSignal().filter(u => u.owner === 'ai' && u.tier === 1 && this.isForest(u.position.x, u.position.y));
    for (const f of farmers) {
      const edges: [Position, Position][] = [
        [{ x: f.position.x, y: f.position.y }, { x: f.position.x + 1, y: f.position.y }],
        [{ x: f.position.x, y: f.position.y }, { x: f.position.x, y: f.position.y + 1 }],
        [{ x: f.position.x - 1, y: f.position.y }, { x: f.position.x, y: f.position.y }],
        [{ x: f.position.x, y: f.position.y - 1 }, { x: f.position.x, y: f.position.y }]
      ];
      for (const [a, b] of edges) {
        if (!this.inBounds(a.x, a.y) || !this.inBounds(b.x, b.y)) continue;
        if (this.getWallBetween(a.x, a.y, b.x, b.y)) continue;
        if (this.canBuildWallBetween(a, b) && this.countNearbyAiUnits(f.position, 2) >= 2) {
          this.aiBuildWallBetween(a, b);
          if (this.wallBuiltThisTurnSignal()) return true;
        }
      }
    }
    return false;
  }
  private tryDefensiveWallsNearForests(): boolean {
    if (this.wallBuiltThisTurnSignal()) return false;
    const aiUnits = this.unitsSignal().filter(u => u.owner === 'ai');
    const playerUnits = this.unitsSignal().filter(u => u.owner === 'player');
    const aiBase = this.getBasePosition('ai');
    for (const u of aiUnits) {
      if (!this.isForest(u.position.x, u.position.y)) continue;
      const enemies = playerUnits.filter(p => Math.max(Math.abs(p.position.x - u.position.x), Math.abs(p.position.y - u.position.y)) <= 2);
      for (const e of enemies) {
        const cheb = Math.max(Math.abs(e.position.x - u.position.x), Math.abs(e.position.y - u.position.y));
        const stepX = Math.sign(e.position.x - u.position.x);
        const stepY = Math.sign(e.position.y - u.position.y);
        if (Math.abs(stepX) + Math.abs(stepY) === 2) continue;
        const targetNeighbor: Position = cheb === 1
          ? { x: u.position.x + stepX, y: u.position.y + stepY }
          : { x: u.position.x + Math.sign(e.position.x - u.position.x), y: u.position.y + Math.sign(e.position.y - u.position.y) };
        if (!this.inBounds(targetNeighbor.x, targetNeighbor.y)) continue;
        const bx = Math.sign(aiBase.x - u.position.x);
        const by = Math.sign(aiBase.y - u.position.y);
        const dot = (targetNeighbor.x - u.position.x) * bx + (targetNeighbor.y - u.position.y) * by;
        if (dot > 0) continue;
        const a = u.position;
        const b = targetNeighbor;
        if (this.getWallBetween(a.x, a.y, b.x, b.y)) continue;
        this.aiBuildWallBetween(a, b);
        if (this.wallBuiltThisTurnSignal()) {
          return true;
        }
      }
    }
    return false;
  }
  private tryLongWalls(): boolean {
    if (this.wallBuiltThisTurnSignal()) return false;
    if (this.aiWoodSignal() <= 100) return false;
    const aiBase = this.getBasePosition('ai');
    const units = this.unitsSignal().filter(u => u.owner === 'ai');
    for (const u of units) {
      if (this.countNearbyAiUnits(u.position, 2) < 2) continue;
      const towardX = Math.sign(aiBase.x - 0);
      const towardY = Math.sign(aiBase.y - 0);
      const targets: [Position, Position][] = [];
      const a = { x: u.position.x, y: u.position.y };
      const b1 = { x: u.position.x + towardX, y: u.position.y };
      const b2 = { x: u.position.x, y: u.position.y + towardY };
      if (this.inBounds(b1.x, b1.y)) targets.push([a, b1]);
      if (this.inBounds(b2.x, b2.y)) targets.push([a, b2]);
      let built = 0;
      for (const [p, q] of targets) {
        if (this.canBuildWallBetween(p, q)) {
          this.aiBuildWallBetween(p, q);
          built++;
          if (built >= 3 || this.wallBuiltThisTurnSignal()) return true;
        }
      }
    }
    return false;
  }
  private isInNoBuildZone(tile: Position): boolean {
    return this.build.isInNoBuildZone(tile, this.getBasePosition('player'), this.getBasePosition('ai'));
  }
  private countNearbyAiUnits(tile: Position, r: number): number {
    return this.unitsSignal().filter(u => u.owner === 'ai' && Math.max(Math.abs(u.position.x - tile.x), Math.abs(u.position.y - tile.y)) <= r).length;
  }
  unitQuadrantBias(): Map<string, { quadrant: number; until: number }> {
    return this.unitQuadrantBiasSignal();
  }
  private getQuadrant(p: Position, center: Position): number {
    const left = p.x <= center.x;
    const top = p.y <= center.y;
    if (left && top) return 0;
    if (!left && top) return 1;
    if (left && !top) return 2;
    return 3;
  }
}
