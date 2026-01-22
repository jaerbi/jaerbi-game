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

  // Computed signals
  readonly units = this.unitsSignal.asReadonly();
  readonly turn = this.turnSignal.asReadonly();
  readonly selectedUnitId = this.selectedUnitIdSignal.asReadonly();
  
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
    // Initial spawn
    this.spawnUnit('player');
    this.spawnUnit('ai');
  }

  // --- Selection & Movement ---

  selectUnit(unitId: string | null) {
    if (!unitId) {
      this.selectedUnitIdSignal.set(null);
      return;
    }
    
    const unit = this.unitsSignal().find(u => u.id === unitId);
    // Only allow selecting own units
    if (unit && unit.owner === 'player') { // Assuming user plays as 'player'
      this.selectedUnitIdSignal.set(unitId);
    }
  }

  moveSelectedUnit(target: Position) {
    const unit = this.selectedUnit();
    if (!unit) return;

    // Validate move again just in case
    const isValid = this.validMoves().some(p => p.x === target.x && p.y === target.y);
    if (!isValid) return;

    this.unitsSignal.update(units => {
      const updatedUnits = [...units];
      const unitIndex = updatedUnits.findIndex(u => u.id === unit.id);
      if (unitIndex === -1) return units;

      const movingUnit = { ...updatedUnits[unitIndex] };
      
      // Check for merge
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
          // Evolution check
          if (movingUnit.level >= 5) {
            movingUnit.level = 1;
            movingUnit.type = 'advanced';
          }
          movingUnit.position = target; // Move to target
          
          // Remove the unit we merged INTO (since we moved the 'movingUnit' there and updated it)
          // Wait, usually you merge A into B. 
          // Let's say we move A onto B. A is movingUnit. B is targetUnit.
          // Result: A is at target pos with combined level. B is removed.
          updatedUnits.splice(targetUnitIndex, 1);
          
          // Update movingUnit in the array (index might have shifted if target was before it)
          // Actually safer to map:
          const finalUnits = updatedUnits.map(u => u.id === movingUnit.id ? movingUnit : u);
          return finalUnits;
        } else {
            // Enemy unit - Logic not defined yet, but for now block or replace?
            // "Goal: Capture the enemy base".
            // If we land on enemy base, we win?
            // If we land on enemy unit? 
            // For now, let's assume validMoves filter prevented this, or we just overwrite (capture/kill).
            // Let's just Overwrite for now if validMoves allowed it.
             movingUnit.position = target;
             updatedUnits.splice(targetUnitIndex, 1); // Kill enemy
             const finalUnits = updatedUnits.map(u => u.id === movingUnit.id ? movingUnit : u);
             return finalUnits;
        }
      } else {
        // Simple move
        movingUnit.position = target;
        updatedUnits[unitIndex] = movingUnit;
        return updatedUnits;
      }
    });

    this.endTurn();
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
      
      // Check bounds
      if (newPos.x >= 0 && newPos.x < this.gridSize && newPos.y >= 0 && newPos.y < this.gridSize) {
        // Check content
        const targetUnit = this.getUnitAt(newPos.x, newPos.y);
        
        if (!targetUnit) {
          moves.push(newPos);
        } else if (targetUnit.owner === unit.owner) {
          // Can merge with friendly
          moves.push(newPos);
        } else {
           // Enemy unit. 
           // For now, let's NOT include enemy tiles as valid moves to keep it simple, 
           // unless it's the base (but base isn't a unit, it's a coord).
           // If an enemy unit is ON the base, can we attack it?
           // Let's assume we can attack (capture) enemy units.
           // moves.push(newPos); 
           // Re-reading: "Merging: If two friendly units land on the same tile..."
           // No mention of attacking.
           // I'll exclude enemy units for now to be safe.
        }
      }
    }
    return moves;
  }

  // --- Turn Management ---

  private endTurn() {
    this.selectedUnitIdSignal.set(null); // Deselect
    this.turnSignal.update(t => t + 1);
    
    // Spawn logic
    if (this.turnSignal() % 2 === 0) { // Every 2 turns
        this.spawnUnit('player');
        this.spawnUnit('ai');
    }
  }

  // --- Spawning (Refactored) ---

  private spawnUnit(owner: Owner) {
    const basePosition: Position = owner === 'player' ? { x: 0, y: 0 } : { x: 9, y: 9 };
    
    this.unitsSignal.update(units => {
      const existingUnitIndex = units.findIndex(u => 
        u.position.x === basePosition.x && 
        u.position.y === basePosition.y && 
        u.owner === owner
      );

      if (existingUnitIndex !== -1) {
        // Merge logic
        const updatedUnits = [...units];
        const existingUnit = { ...updatedUnits[existingUnitIndex] };
        existingUnit.level += 1;
        
        // Evolution check
        if (existingUnit.level >= 5) {
            existingUnit.level = 1;
            existingUnit.type = 'advanced';
        }
        
        updatedUnits[existingUnitIndex] = existingUnit;
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
