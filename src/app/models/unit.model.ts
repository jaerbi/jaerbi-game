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

export interface Position {
    x: number;
    y: number;
}

export type TileType = 'path' | 'buildable' | 'void';

export interface Tower {
    id: string;
    type: number;
    level: number;
    position: Position;
    baseCost: number;
    invested: number;
    damage: number;
    range: number;
    fireInterval: number;
    cooldown: number;
    specialActive: boolean;
}

export interface Enemy {
    id: string;
    position: Position;
    pathIndex: number;
    hp: number;
    maxHp: number;
    speed: number;
    progress: number;
    isBoss?: boolean;
    hue: number;
    baseSpeed: number;
    speedModifier: number;
    shatterStacks: number;
    isFrozen: boolean;
}

export interface Projectile {
    id: string;
    from: Position;
    to: Position;
    progress: number;
}

export interface TDTile {
    x: number;
    y: number;
    type: TileType;
    tower: Tower | null;
}

