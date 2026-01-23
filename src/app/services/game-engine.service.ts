import { Injectable, signal, computed } from '@angular/core';
import { Unit, Position, Owner } from '../models/unit.model';
import { CombatService } from './combat.service';
import { BuildService } from './build.service';
import { LogService } from './log.service';

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
  readonly gridSize = 10;
  
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
  private buildModeSignal = signal<boolean>(false);
  private fogDebugDisabledSignal = signal<boolean>(false);
  private wallBuiltThisTurnSignal = signal<boolean>(false);
  private rulesOpenSignal = signal<boolean>(false);
  private movedThisTurnSignal = signal<Set<string>>(new Set<string>());
  private aiWoodSignal = signal<number>(0);
  private logsOpenSignal = signal<boolean>(false);
  private logsSignal = signal<string[]>([]);
  private activeSideSignal = signal<Owner>('ai');

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
  readonly buildMode = this.buildModeSignal.asReadonly();
  readonly fogDebugDisabled = this.fogDebugDisabledSignal.asReadonly();
  readonly wallBuiltThisTurn = this.wallBuiltThisTurnSignal.asReadonly();
  readonly rulesOpen = this.rulesOpenSignal.asReadonly();
  
  readonly selectedUnit = computed(() => 
    this.unitsSignal().find(u => u.id === this.selectedUnitIdSignal()) || null
  );

  readonly validMoves = computed(() => {
    const unit = this.selectedUnit();
    if (!unit) return [];
    return this.calculateValidMoves(unit);
  });

  // Grid dimensions
  readonly gridRows = Array.from({ length: this.gridSize }, (_, i) => i);
  readonly gridCols = Array.from({ length: this.gridSize }, (_, i) => i);

  constructor(private combat: CombatService, private build: BuildService, private log: LogService) {
    this.resetGame();
  }

  resetGame() {
    this.unitsSignal.set([]);
    this.turnSignal.set(1);
    this.activeSideSignal.set('ai');
    this.selectedUnitIdSignal.set(null);
    this.gameStatusSignal.set('playing');
    this.lastMergedUnitIdSignal.set(null);
    this.lastRemainderUnitIdSignal.set(null);
    this.resourcesSignal.set({ wood: 0 });
    this.baseHealthSignal.set({ player: 100, ai: 100 });
    this.reservePointsSignal.set({ player: 5, ai: 5 });
    this.deployTargetsSignal.set([]);
    this.forestsSignal.set(this.generateForests());
    this.wallsSignal.set([]);
    this.baseDeployActiveSignal.set(false);
    this.buildModeSignal.set(false);
    this.fogDebugDisabledSignal.set(false);
    this.wallBuiltThisTurnSignal.set(false);
    this.spawnStarterArmy('player');
    this.spawnStarterArmy('ai');
    this.recomputeVisibility();
    setTimeout(() => this.aiTurn(), 0);
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

      for (let i = 1; i <= steps; i++) {
        const from = { x: start.x + stepX * (i - 1), y: start.y + stepY * (i - 1) };
        const to = { x: start.x + stepX * i, y: start.y + stepY * i };
        const wall = this.getWallBetween(from.x, from.y, to.x, to.y);
        if (wall) {
          if (wall.owner === movingUnit.owner) {
            return updatedUnits;
          } else {
            const dmgPercent = movingUnit.tier === 1 ? 34 : movingUnit.tier === 2 ? 51 : 100;
            this.wallsSignal.update(ws =>
              ws
                .map(w =>
                  w.id === wall.id
                    ? { ...w, health: Math.max(0, (w as any).health - dmgPercent) }
                    : w
                )
                .filter((w: any) => (w.health ?? w.hitsRemaining ?? 0) > 0)
            );
            this.appendLog(`[Turn ${this.turnSignal()}] ${movingUnit.owner === 'player' ? 'Player' : 'AI'} auto-hit wall between (${from.x},${from.y})-(${to.x},${to.y}) for ${dmgPercent}% damage.`);
            return updatedUnits;
          }
        }
      }

      const opponentBase = movingUnit.owner === 'player' ? { x: 9, y: 9 } : { x: 0, y: 0 };
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
          const wallBetweenCombat = this.getWallBetween(lastFrom.x, lastFrom.y, target.x, target.y);
          if (wallBetweenCombat) {
            return updatedUnits;
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
            const attackerBase = this.calculateTotalPoints(movingUnit);
            const luckObj = this.getAttackLuckModifier(movingUnit);
            const defenderBase = this.calculateTotalPoints(targetUnit);
            const defBonus = this.combat.getDefenseBonus(targetUnit, updatedUnits);
            const attackerPoints = Math.max(0, attackerBase + luckObj.delta);
            const defenderPoints = defenderBase + defBonus.bonus;

            const modifiersText = [...defBonus.tags, luckObj.tag ?? ''].filter(Boolean).join(', ') || 'None';
            const formulaText =
              `[Turn ${this.turnSignal()}] ${movingUnit.owner === 'player' ? 'Player' : 'AI'} T${movingUnit.tier}(L${movingUnit.level}) attacked ${targetUnit.owner === 'player' ? 'Player' : 'AI'} T${targetUnit.tier}(L${targetUnit.level}). ` +
              `Power: ${attackerBase} vs ${defenderBase}. ` +
              `Modifiers: ${modifiersText}. ` +
              `Final: (${attackerBase}${luckObj.delta !== 0 ? (luckObj.delta > 0 ? `+${luckObj.delta}` : `${luckObj.delta}`) : ''}${defBonus.bonus > 0 ? ` - ${defBonus.bonus}` : ''}) - ${defenderBase} = ${Math.abs(attackerPoints - defenderPoints)}.`;
            this.log.addCombat(movingUnit.owner, formulaText, !!luckObj.isCrit);

            if (attackerPoints <= defenderPoints) {
              this.queueCombatText('WEAK!', target);
            }

            if (attackerPoints > defenderPoints) {
              const newPoints = attackerPoints - defenderPoints;
              const { tier, level } = this.calculateTierAndLevel(newPoints);
              
              movingUnit.points = newPoints;
              movingUnit.tier = tier;
              movingUnit.level = level;
              
              updatedUnits.splice(targetUnitIndex, 1); // Remove defender
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
                this.queueCombatText('LUCKY!', target);
                if (survivorIsAttacker) {
                  const baseMin = this.getPointsForTierLevel(movingUnit.tier, 1);
                  movingUnit.points = baseMin;
                  const tl = this.calculateTierAndLevel(baseMin);
                  movingUnit.tier = tl.tier;
                  movingUnit.level = tl.level;
                  updatedUnits.splice(targetUnitIndex, 1);
                  this.log.addCombat(movingUnit.owner, `[Turn ${this.turnSignal()}] Result: LUCKY - Attacker survived!`, false);
                } else {
                  const baseMin = this.getPointsForTierLevel(targetUnit.tier, 1);
                  const defender = { ...targetUnit, points: baseMin };
                  const tl = this.calculateTierAndLevel(baseMin);
                  defender.tier = tl.tier;
                  defender.level = tl.level;
                  updatedUnits[targetUnitIndex] = defender;
                  updatedUnits.splice(unitIndex, 1);
                  this.log.addCombat(movingUnit.owner, `[Turn ${this.turnSignal()}] Result: LUCKY - Defender survived!`, false);
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
    
    if (this.gameStatus() === 'playing') {
      this.endTurn();
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
 
  private getHighestAffordableCost(reserves: number): number {
    const costs = [500, 375, 250, 125, 100, 75, 50, 25, 20, 15, 10, 5, 4, 3, 2, 1];
    for (const c of costs) {
      if (reserves >= c) return c;
    }
    return 0;
  }
  
  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.gridSize && y >= 0 && y < this.gridSize;
  }
  
  private recomputeVisibility() {
    const playerBase = this.getBasePosition('player');
    const aiBase = this.getBasePosition('ai');
    const res = { player: new Set<string>(), ai: new Set<string>() };
    const units = this.unitsSignal();
    const mark = (set: Set<string>, x: number, y: number) => {
      if (this.inBounds(x, y)) set.add(`${x},${y}`);
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
    markRadius(res.player, playerBase, 3);
    markRadius(res.ai, aiBase, 3);
    for (const u of units) {
      const set = u.owner === 'player' ? res.player : res.ai;
      markRadius(set, u.position, 2);
    }
    this.playerVisibilitySignal.set(res.player);
    this.aiVisibilitySignal.set(res.ai);
  }
  
  isVisibleToPlayer(x: number, y: number): boolean {
    if (this.fogDebugDisabledSignal()) return true;
    return this.playerVisibilitySignal().has(`${x},${y}`);
  }
  
  isVisibleToAi(x: number, y: number): boolean {
    if (this.fogDebugDisabledSignal()) return true;
    return this.aiVisibilitySignal().has(`${x},${y}`);
  }

  private calculatePower(unit: Unit): number {
      return this.calculateTotalPoints(unit);
  }

  private checkBaseDefeat() {
    const hp = this.baseHealthSignal();
    if (hp.ai <= 0) {
      this.gameStatusSignal.set('player wins');
    } else if (hp.player <= 0) {
      this.gameStatusSignal.set('ai wins');
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
  getCombatTextEntriesAt(x: number, y: number): { id: string; text: string; opacity: number }[] {
    return this.combatTextsSignal()
      .filter(e => e.position.x === x && e.position.y === y)
      .map(e => ({ id: e.id, text: e.text, opacity: e.opacity }));
  }

  private getAttackLuckModifier(unit: Unit): { delta: number; tag?: string; isCrit?: boolean } {
    const res = this.combat.getAttackLuckModifier(unit);
    if (res.tag) this.queueCombatText(res.tag.startsWith('CRIT') ? 'CRIT!' : 'MISS!', unit.position);
    return res;
  }

  private queueCombatText(text: string, position: Position) {
    const id = crypto.randomUUID();
    const entry = { id, text, position: { ...position }, opacity: 1 };
    this.combatTextsSignal.update(arr => [...arr, entry]);
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
            const stepH = { x: from.x + dir.x, y: from.y };
            const stepV = { x: from.x, y: from.y + dir.y };
            const wallH = this.getWallBetween(from.x, from.y, stepH.x, stepH.y);
            const wallV = this.getWallBetween(from.x, from.y, stepV.x, stepV.y);
            if (wallH || wallV) {
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
        if (movedIds.has(u.id)) {
          return { ...u, turnsStationary: 0 };
        }
        return { ...u, turnsStationary: (u.turnsStationary ?? 0) + 1 };
      })
    );
    this.movedThisTurnSignal.set(new Set<string>());
    this.wallBuiltThisTurnSignal.set(false);

    if (this.gameStatus() === 'playing') {
      const countOnForest = this.unitsSignal().filter(u => u.owner === ownerJustActed && this.isForest(u.position.x, u.position.y)).length;
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
    // Switch phase; when player finishes, increment turn and add reserves
    if (ownerJustActed === 'player') {
      this.turnSignal.update(t => t + 1);
      this.reservePointsSignal.update(r => ({ player: r.player + 1, ai: r.ai + 1 }));
      this.activeSideSignal.set('ai');
      if (this.gameStatus() === 'playing') setTimeout(() => this.aiTurn(), 150);
    } else {
      this.activeSideSignal.set('player');
    }
  }

  // --- AI Logic ---

  private aiTurn() {
    if (this.gameStatus() !== 'playing') return;

    if (!this.wallBuiltThisTurnSignal()) {
      const aiBase = this.getBasePosition('ai');
      const candidates = this.unitsSignal()
        .filter(u => u.owner === 'player')
        .filter(u => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3)
        .sort((a, b) => this.calculateTotalPoints(b) - this.calculateTotalPoints(a));
      for (const enemy of candidates) {
        const dx = Math.sign(aiBase.x - enemy.position.x);
        const dy = Math.sign(aiBase.y - enemy.position.y);
        const edges: Position[] = [];
        if (dx !== 0) edges.push({ x: enemy.position.x + dx, y: enemy.position.y });
        if (dy !== 0) edges.push({ x: enemy.position.x, y: enemy.position.y + dy });
        for (const e of edges) {
          const a = enemy.position;
          const b = e;
          if (this.canBuildWallBetween(a, b)) {
            this.aiBuildWallBetween(a, b);
            this.wallBuiltThisTurnSignal.set(true);
            break;
          }
        }
        if (this.wallBuiltThisTurnSignal()) break;
      }
    }

    const aiReserves = this.reservePointsSignal().ai;
    let isAdjToBase: (p: Position) => boolean = () => false;
    if (aiReserves >= 1) {
      const base = this.getBasePosition('ai');
      const targets: Position[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const x = base.x + dx;
          const y = base.y + dy;
          if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) continue;
          const occupiedUnit = this.getUnitAt(x, y);
          if (!occupiedUnit) targets.push({ x, y });
        }
      }
      if (targets.length > 0) {
        const cost = this.getHighestAffordableCost(aiReserves);
        if (cost > 0) {
          const pos = targets[Math.floor(Math.random() * targets.length)];
          const tl = this.calculateTierAndLevel(cost);
          this.unitsSignal.update(units => {
            const newUnit: Unit = {
              id: crypto.randomUUID(),
              position: { ...pos },
              level: tl.level,
              tier: tl.tier,
              points: cost,
              owner: 'ai',
              turnsStationary: 0
            };
            return [...units, newUnit];
          });
          this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai - cost }));
          this.recomputeVisibility();
        }
      }
      // Base clearance priority if reserves are high and all spawn tiles are blocked
      const needClearBase = aiReserves > 20 && targets.length === 0;
      const baseAdjKey = new Set<string>();
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const x = base.x + dx;
          const y = base.y + dy;
          if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) continue;
          baseAdjKey.add(`${x},${y}`);
        }
      }
      isAdjToBase = (p: Position) => baseAdjKey.has(`${p.x},${p.y}`);
    }
 
    const aiUnits = this.unitsSignal().filter(u => u.owner === 'ai');
    if (aiUnits.length === 0) {
      this.endTurn();
      return;
    }

    let bestMove: { unit: Unit, target: Position, score: number } | null = null;
    const playerBase = { x: 0, y: 0 };

    for (const unit of aiUnits) {
        const moves = this.calculateValidMoves(unit);
        const myPower = this.calculatePower(unit);

        for (const move of moves) {
            let score = 0;
            
            // Distance to player base
            const dist = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
            score -= dist * 10; 

            const targetUnit = this.getUnitAt(move.x, move.y);
            if (targetUnit) {
                if (targetUnit.owner === 'ai') {
                    if (targetUnit.tier === unit.tier) {
                      score += 50; 
                      const mergedPoints = this.calculateTotalPoints(unit) + this.calculateTotalPoints(targetUnit);
                      const { tier } = this.calculateTierAndLevel(mergedPoints);
                      if (tier > unit.tier) score += 30;
                    }
                } else {
                    if (this.isVisibleToAi(move.x, move.y)) {
                      const enemyPower = this.calculatePower(targetUnit);
                      if (myPower > enemyPower) {
                          score += 100 + (enemyPower * 2);
                      } else if (myPower < enemyPower) {
                          score -= 500;
                      } else {
                          score -= 50;
                      }
                    }
                }
            }

            if (this.isForest(move.x, move.y)) {
                score += 30;
            }
            // Anti-deadlock: strongly prefer moving units away from base adjacency to clear spawn
            if (typeof isAdjToBase === 'function') {
              if (isAdjToBase(unit.position) && !isAdjToBase(move)) {
                // Base clearance gets very high priority when reserves are high and spawn is blocked
                score += (aiReserves > 20 ? 1000 : 200);
              }
            }

            if (!bestMove || score > bestMove.score) {
                bestMove = { unit, target: move, score };
            }
        }
    }

    if (bestMove) {
        this.executeMove(bestMove.unit, bestMove.target);
    } else {
        this.endTurn();
    }
  }

  // --- Spawning ---

  spawnUnit(owner: Owner) {
    const basePosition: Position = owner === 'player' ? { x: 0, y: 0 } : { x: 9, y: 9 };
    this.unitsSignal.update(units => {
      const occupied = units.some(u => u.position.x === basePosition.x && u.position.y === basePosition.y);
      if (occupied) return units;
      const newUnit: Unit = { id: crypto.randomUUID(), position: { ...basePosition }, level: 1, tier: 1, points: 1, owner, turnsStationary: 0 };
      return [...units, newUnit];
    });
  }
 
  private spawnStarterArmy(owner: Owner) {
    const base = this.getBasePosition(owner);
    const radius = 3;
    const candidates: Position[] = [];
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const x = base.x + dx;
        const y = base.y + dy;
        if (!this.inBounds(x, y)) continue;
        if (dx === 0 && dy === 0) continue;
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
 
  isValidMove(x: number, y: number): boolean {
      return this.validMoves().some(p => p.x === x && p.y === y);
  }

  isForest(x: number, y: number): boolean {
    return this.forestsSignal().some(p => p.x === x && p.y === y);
  }

  private generateForests(): Position[] {
    const count = Math.floor(Math.random() * 4) + 5;
    const positions: Position[] = [];
    const forbidden = new Set(['0,0', '9,9']);
    while (positions.length < count) {
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);
      const key = `${x},${y}`;
      if (forbidden.has(key)) continue;
      if (positions.some(p => p.x === x && p.y === y)) continue;
      positions.push({ x, y });
    }
    return positions;
  }

  getBasePosition(owner: Owner): Position {
    return owner === 'player' ? { x: 0, y: 0 } : { x: 9, y: 9 };
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
    this.appendLog(`[Turn ${this.turnSignal()}] Player built wall between (${a.x},${a.y})-(${b.x},${b.y}). Cost: 10 Wood.`);
  }
 
  convertWoodToReserve() {
    const wood = this.resourcesSignal().wood;
    if (wood < 20) return;
    this.resourcesSignal.update(r => ({ wood: r.wood - 20 }));
    this.reservePointsSignal.update(r => ({ player: r.player + 1, ai: r.ai }));
    this.appendLog(`[Turn ${this.turnSignal()}] Player converted 20 Wood → +1 Reserve.`);
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
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const x = base.x + dx;
        const y = base.y + dy;
        if (x < 0 || x >= this.gridSize || y < 0 || y >= this.gridSize) continue;
        const occupiedUnit = this.getUnitAt(x, y);
        if (!occupiedUnit) targets.push({ x, y });
      }
    }
    this.deployTargetsSignal.set(targets);
    this.baseDeployActiveSignal.set(true);
  }

  isDeployTarget(x: number, y: number): boolean {
    return this.deployTargetsSignal().some(p => p.x === x && p.y === y);
  }

  deployTo(target: Position) {
    if (!this.isDeployTarget(target.x, target.y)) return;
    const reserves = this.reservePointsSignal().player;
    if (reserves <= 0) return;
    const cost = this.getHighestAffordableCost(reserves);
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

    const dmgPercent = unit.tier === 1 ? 34 : unit.tier === 2 ? 51 : 100;
    this.wallsSignal.update(ws =>
      ws
        .map(w =>
          w.id === wall.id
            ? { ...w, health: Math.max(0, w.health - dmgPercent) }
            : w
        )
        .filter(w => w.health > 0)
    );
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
  private isInNoBuildZone(tile: Position): boolean {
    return this.build.isInNoBuildZone(tile, this.getBasePosition('player'), this.getBasePosition('ai'));
  }
}
