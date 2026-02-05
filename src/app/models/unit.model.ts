export interface Position {
  x: number;
  y: number;
}

export type Owner = 'player' | 'ai';
export type AggressionAiMode = 'none' | 'angry' | 'rage';

export interface Unit {
  id: string;
  position: Position;
  level: number;
  tier: number; // 1 to 4
  points: number;
  owner: Owner;
  turnsStationary: number;
  forestOccupationTurns?: number;
  mineOccupationTurns?: number;
  productionActive?: boolean;
  hasActed: boolean;
  hasWeapon?: boolean;
  hasArmor?: boolean;
  armorHp?: number;
}
