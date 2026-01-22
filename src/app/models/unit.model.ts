export interface Position {
  x: number;
  y: number;
}

export type Owner = 'player' | 'ai';
export type UnitType = 'basic' | 'advanced';

export interface Unit {
  id: string;
  position: Position;
  level: number;
  owner: Owner;
  type: UnitType;
}
