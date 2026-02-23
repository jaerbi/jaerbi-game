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
    tier: number;
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
    strategy?: 'first' | 'weakest' | 'strongest' | 'random';
    hasGolden?: boolean;
    targetEnemyId?: string;
    beamTime?: number;
    lastBeamTargetId?: string;
    extraTargetIds?: string[];
    hitsOnTarget?: number;
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
    displayX?: number;
    displayY?: number;
    bg?: string;
    scale?: number;
    stunTime?: number;
    type?: 'tank' | 'scout' | 'standard' | 'boss';
    burnedByInferno?: boolean;
    prismVulnerableTime?: number;
    venomStacks?: number;
    venomDuration?: number;
    venomTickTimer?: number;
    venomBaseDamage?: number;
    venomSlowActive?: boolean;
    isMagma?: boolean;
    isMirror?: boolean;
    isSlime?: boolean;
}

export interface Projectile {
    id: string;
    from: Position;
    to: Position;
    progress: number;
    speedMultiplier?: number;
}

export interface InfernoZone {
    id: string;
    position: Position;
    radius: number;
    remaining: number;
    dps: number;
}

export interface TDTile {
    x: number;
    y: number;
    type: TileType;
    tower: Tower | null;
}

