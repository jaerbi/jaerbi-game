import { Injectable, signal } from '@angular/core';
import { Unit, Position, Owner } from '../models/unit.model';

@Injectable({
  providedIn: 'root'
})
export class GameEngineService {
  readonly gridSize = 10;
  
  // State using Signals
  private unitsSignal = signal<Unit[]>([]);
  private turnSignal = signal<number>(1);

  // Computed signals
  readonly units = this.unitsSignal.asReadonly();
  readonly turn = this.turnSignal.asReadonly();
  
  // Grid dimensions
  readonly gridRows = Array.from({ length: this.gridSize }, (_, i) => i);
  readonly gridCols = Array.from({ length: this.gridSize }, (_, i) => i);

  constructor() {}

  spawnUnit(owner: Owner) {
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
}
