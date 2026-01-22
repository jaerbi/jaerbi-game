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

  // Computed signals
  readonly units = this.unitsSignal.asReadonly();
  readonly turn = this.turnSignal.asReadonly();
  readonly selectedUnitId = this.selectedUnitIdSignal.asReadonly();
  readonly gameStatus = this.gameStatusSignal.asReadonly();
  readonly lastMergedUnitId = this.lastMergedUnitIdSignal.asReadonly();
  
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

    this.unitsSignal.update(units => {
      const updatedUnits = [...units];
      const unitIndex = updatedUnits.findIndex(u => u.id === unit.id);
      if (unitIndex === -1) return units;

      const movingUnit = { ...updatedUnits[unitIndex] };
      
      const targetUnitIndex = updatedUnits.findIndex(u => 
        u.position.x === target.x && 
        u.position.y === target.y && 
        u.id !== movingUnit.id
      );

      if (targetUnitIndex !== -1) {
        const targetUnit = updatedUnits[targetUnitIndex];
        if (targetUnit.owner === movingUnit.owner) {
          // Merge Logic
          movingUnit.level += targetUnit.level;
          merged = true;
          
          if (movingUnit.level >= 5) {
            movingUnit.level = 1;
            movingUnit.type = 'advanced';
          }
          
          updatedUnits.splice(targetUnitIndex, 1);
        } else {
            // Capture Enemy
             updatedUnits.splice(targetUnitIndex, 1);
        }
      }

      movingUnit.position = target;
      
      // Update the moving unit in the array
      // Find index again or map? Map is safer if splice shifted indices? 
      // Actually we spliced targetUnitIndex.
      // If targetUnitIndex < unitIndex, unitIndex shifted down by 1.
      // Let's just map by ID to be safe.
      return updatedUnits.map(u => u.id === movingUnit.id ? movingUnit : u);
    });

    if (merged) {
      this.lastMergedUnitIdSignal.set(unit.id);
      // Reset animation trigger after short delay
      setTimeout(() => this.lastMergedUnitIdSignal.set(null), 300);
    }

    this.checkWinCondition(unit.owner, target);
    
    if (this.gameStatus() === 'playing') {
      this.endTurn();
    }
  }

  private checkWinCondition(moverOwner: Owner, pos: Position) {
    if (moverOwner === 'player' && pos.x === 9 && pos.y === 9) {
      this.gameStatusSignal.set('player wins');
    } else if (moverOwner === 'ai' && pos.x === 0 && pos.y === 0) {
      this.gameStatusSignal.set('ai wins');
    }
  }

  private calculateValidMoves(unit: Unit): Position[] {
    const moves: Position[] = [];
    const directions = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 } // Basic
    ];

    if (unit.type === 'advanced') {
      directions.push(
        { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 } // Diagonals
      );
    }

    for (const dir of directions) {
      const newPos = { x: unit.position.x + dir.x, y: unit.position.y + dir.y };
      
      if (newPos.x >= 0 && newPos.x < this.gridSize && newPos.y >= 0 && newPos.y < this.gridSize) {
        const targetUnit = this.getUnitAt(newPos.x, newPos.y);
        
        if (!targetUnit) {
          moves.push(newPos);
        } else if (targetUnit.owner === unit.owner) {
          // Can merge
          moves.push(newPos);
        } else {
           // Can capture enemy
           moves.push(newPos);
        }
      }
    }
    return moves;
  }

  // --- Turn Management ---

  private endTurn() {
    this.selectedUnitIdSignal.set(null); 
    this.turnSignal.update(t => t + 1);
    
    // Spawn logic every 2 turns
    if (this.turnSignal() % 2 === 0) { 
        this.spawnUnit('player');
        this.spawnUnit('ai');
    }

    // AI Turn Trigger
    // We can use a setTimeout to simulate "thinking" and avoid synchronous UI blocking
    if (this.gameStatus() === 'playing') {
        // If it was player's turn, now it might be AI's "move" phase? 
        // But the requirement says "Turn-based". 
        // "Units move 1 tile per turn". 
        // Usually in strategy games: Player Move -> AI Move -> Turn End? 
        // OR Player moves 1 unit, then turn ends. Then AI moves 1 unit.
        // The prompt says: "Units spawn... every 2 turns". 
        // And "End Turn: After a move is completed, increment turnSignal".
        // So: Turn 1 (Player moves) -> Turn 2 (AI moves) -> Turn 3 (Player moves + Spawn) -> Turn 4 (AI moves) -> Turn 5 (Player moves + Spawn).
        
        // So if turn is EVEN, it's AI's turn?
        // Turn 1: Player. 
        // Turn 2: AI.
        // Turn 3: Player.
        
        if (this.turnSignal() % 2 === 0) {
            // It's AI's turn (Turn 2, 4, 6...)
            setTimeout(() => this.aiTurn(), 500);
        }
    }
  }

  // --- AI Logic ---

  private aiTurn() {
    if (this.gameStatus() !== 'playing') return;

    const aiUnits = this.unitsSignal().filter(u => u.owner === 'ai');
    if (aiUnits.length === 0) {
        // AI has no units, skip turn (or resign?)
        this.endTurn(); 
        return;
    }

    let bestMove: { unit: Unit, target: Position, score: number } | null = null;
    const playerBase = { x: 0, y: 0 };

    for (const unit of aiUnits) {
        const moves = this.calculateValidMoves(unit);
        for (const move of moves) {
            let score = 0;
            
            // Distance to player base (lower is better)
            const dist = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
            score -= dist * 10; 

            // Check for merge/capture
            const targetUnit = this.getUnitAt(move.x, move.y);
            if (targetUnit) {
                if (targetUnit.owner === 'ai') {
                    // Merge priority
                    score += 50; 
                    if (unit.level + targetUnit.level >= 5) score += 20; // Evolution bonus
                } else {
                    // Capture priority
                    score += 100;
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
        // No valid moves? Skip turn
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
        existingUnit.level += 1;
        
        if (existingUnit.level >= 5) {
            existingUnit.level = 1;
            existingUnit.type = 'advanced';
        }
        
        updatedUnits[existingUnitIndex] = existingUnit;
        
        // Trigger merge animation for spawn merge
        if (owner === 'player') { // Only animate player for now or generic?
             this.lastMergedUnitIdSignal.set(existingUnit.id);
             setTimeout(() => this.lastMergedUnitIdSignal.set(null), 300);
        }

        return updatedUnits;
      } else {
        const newUnit: Unit = {
          id: crypto.randomUUID(),
          position: { ...basePosition },
          level: 1,
          owner: owner,
          type: 'basic'
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
}
