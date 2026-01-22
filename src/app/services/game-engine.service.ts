import { Injectable, signal, computed } from '@angular/core';
import { Unit, Position, Owner } from '../models/unit.model';

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

  constructor() {
    this.resetGame();
  }

  resetGame() {
    this.unitsSignal.set([]);
    this.turnSignal.set(1);
    this.selectedUnitIdSignal.set(null);
    this.gameStatusSignal.set('playing');
    this.lastMergedUnitIdSignal.set(null);
    this.lastRemainderUnitIdSignal.set(null);
    this.resourcesSignal.set({ wood: 0 });
    this.baseHealthSignal.set({ player: 100, ai: 100 });
    this.forestsSignal.set(this.generateForests());
    this.spawnUnit('player');
    this.spawnUnit('ai');
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
        if (targetUnit.owner === movingUnit.owner) {
          // Merge Logic (New Rule: Level Summing & Remainder)
          if (targetUnit.tier === movingUnit.tier) {
            const sumLevels = movingUnit.level + targetUnit.level;
            
            if (sumLevels <= 5) {
                // Simple Merge
                targetUnit.level = sumLevels;
                updatedUnits.splice(unitIndex, 1); // Remove moving unit
            } else {
                // Evolution + Remainder
                const remainder = sumLevels - 5;
                
                // Target evolves
                targetUnit.tier += 1;
                targetUnit.level = 1;
                if (targetUnit.tier > 4) { // Cap at T4L5
                    targetUnit.tier = 4;
                    targetUnit.level = 5;
                }
                
                // Moving unit becomes remainder (stays at old position)
                movingUnit.level = remainder;
                updatedUnits[unitIndex] = movingUnit; // Update in place
                remainderId = movingUnit.id;
            }
            merged = true;
          } else {
            return updatedUnits; // Should be blocked by isValidMove, but safety check
          }
        } else {
            // Combat Logic (50% Attrition Rule)
            const attackerPoints = this.calculateTotalPoints(movingUnit);
            const defenderPoints = this.calculateTotalPoints(targetUnit);

            if (attackerPoints > defenderPoints) {
              const newPoints = attackerPoints - Math.floor(defenderPoints / 2);
              const { tier, level } = this.calculateTierAndLevel(newPoints);
              
              movingUnit.tier = tier;
              movingUnit.level = level;
              
              updatedUnits.splice(targetUnitIndex, 1); // Remove defender
              // movingUnit moves to target (below)
            } else if (attackerPoints < defenderPoints) {
              const newPoints = defenderPoints - Math.floor(attackerPoints / 2);
              const { tier, level } = this.calculateTierAndLevel(newPoints);
              
              const defender = { ...targetUnit, tier, level };
              updatedUnits[targetUnitIndex] = defender;
              updatedUnits.splice(unitIndex, 1); // Remove attacker
              return updatedUnits;
            } else {
              // Draw - Both Removed
              return updatedUnits.filter(u => u.id !== movingUnit.id && u.id !== targetUnit.id);
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
             // Update the unit in the array
             const idx = updatedUnits.findIndex(u => u.id === movingUnit.id);
             if (idx !== -1) updatedUnits[idx] = movingUnit;
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
  
  // Total Points = (Tier - 1) * 4 + Level
  // T1L1=1, T1L4=4, T2L1=5
  private calculateTotalPoints(unit: Unit): number {
    return (unit.tier - 1) * 5 + unit.level;
  }

  private calculateTierAndLevel(points: number): { tier: number, level: number } {
    let tier = Math.floor((points - 1) / 5) + 1;
    let level = ((points - 1) % 5) + 1;
    if (tier > 4) {
      tier = 4;
      level = 5;
    }
    return { tier, level };
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
            const newPos = { x: unit.position.x + (dir.x * i), y: unit.position.y + (dir.y * i) };
            
            if (newPos.x >= 0 && newPos.x < this.gridSize && newPos.y >= 0 && newPos.y < this.gridSize) {
                const targetUnit = this.getUnitAt(newPos.x, newPos.y);
                
                if (!targetUnit) {
                    moves.push(newPos);
                } else {
                    if (targetUnit.owner === unit.owner) {
                        // Merge check
                        if (targetUnit.tier === unit.tier) {
                            moves.push(newPos);
                        }
                    } else {
                        moves.push(newPos);
                    }
                    break;
                }
            } else {
                break; // Out of bounds
            }
        }
    }
    return moves;
  }

  // --- Turn Management ---

  private endTurn() {
    this.selectedUnitIdSignal.set(null); 
    this.turnSignal.update(t => t + 1);
    
    if (this.turnSignal() % 2 === 0) { 
        this.spawnUnit('player');
        this.spawnUnit('ai');
    }

    if (this.gameStatus() === 'playing') {
        if (this.turnSignal() % 2 === 0) {
            setTimeout(() => this.aiTurn(), 500);
        }
    }

    if (this.gameStatus() === 'playing') {
      if (this.turnSignal() % 2 === 1) {
        const ownedOnForest = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y)).length;
        if (ownedOnForest > 0) {
          this.resourcesSignal.update(r => ({ wood: r.wood + ownedOnForest * 2 }));
        }
      }
    }
  }

  // --- AI Logic ---

  private aiTurn() {
    if (this.gameStatus() !== 'playing') return;

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

            if (this.isForest(move.x, move.y)) {
                score += 30;
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
      const existingUnitIndex = units.findIndex(u => 
        u.position.x === basePosition.x && 
        u.position.y === basePosition.y && 
        u.owner === owner
      );

      if (existingUnitIndex !== -1) {
        const updatedUnits = [...units];
        const existingUnit = { ...updatedUnits[existingUnitIndex] };
        
        // Spawn Merge: Add T1L1 (1 point)
        const totalPoints = this.calculateTotalPoints(existingUnit) + 1; // +1 point for new spawn
        const { tier, level } = this.calculateTierAndLevel(totalPoints);
        existingUnit.tier = tier;
        existingUnit.level = level;
        
        updatedUnits[existingUnitIndex] = existingUnit;
        
        if (owner === 'player') {
             this.lastMergedUnitIdSignal.set(existingUnit.id);
             setTimeout(() => this.lastMergedUnitIdSignal.set(null), 300);
        }

        return updatedUnits;
      } else {
        const newUnit: Unit = {
          id: crypto.randomUUID(),
          position: { ...basePosition },
          level: 1,
          tier: 1,
          owner: owner
        };
        return [...units, newUnit];
      }
    });
  }

  getUnitAt(x: number, y: number): Unit | undefined {
    return this.unitsSignal().find(u => u.position.x === x && u.position.y === y);
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
}
