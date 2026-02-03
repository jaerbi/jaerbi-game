import { Injectable, signal, computed } from '@angular/core';
import { Unit, Position, Owner, AggressionAiMode } from '../models/unit.model';
import { CombatService } from './combat.service';
import { BuildService } from './build.service';
import { LogService } from './log.service';
import { SettingsService, Difficulty, MapSize } from './settings.service';
import { MapService } from './map.service';
import { EconomyService } from './economy.service';
import { AiStrategyService } from './ai-strategy.service';
import { FirebaseService, ScoreEntry } from './firebase.service';
import { PlayerNameService } from './player-name.service';

interface Wall {
    id: string;
    tile1: Position;
    tile2: Position;
    health: number;
    owner: 'player' | 'ai' | 'neutral';
    formationId?: string;
    formationSize?: number;
    maxHealth?: number;
    bonusHp?: number;
}

interface TurnContext {
    claimedTargets: Set<string>;
    priorityTargets: Unit[];
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
    private gameStatusSignal = signal<'playing' | 'player wins' | 'jaerbi wins'>('playing');
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
    private buildModeSignal = signal<boolean>(false);
    private fogDebugDisabledSignal = signal<boolean>(false);
    private wallBuiltThisTurnSignal = signal<boolean>(false);
    private rulesOpenSignal = signal<boolean>(false);
    private movedThisTurnSignal = signal<Set<string>>(new Set<string>());
    private hoveredFormationIdSignal = signal<string | null>(null);
    private aiWoodSignal = signal<number>(0);
    private logsOpenSignal = signal<boolean>(false);
    private settingsOpenSignal = signal<boolean>(false);
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
    private highScoresOpenSignal = signal<boolean>(false);
    private leaderboardOpenSignal = signal<boolean>(false);
    private namePromptOpenSignal = signal<boolean>(false);
    private pendingScoreSignal = signal<ScoreEntry | null>(null);
    private supportOpenSignal = signal<boolean>(false);
    private highScoresSignal = signal<Record<string, { wins: { turns: number; date: number; condition: string }[]; losses: { turns: number; date: number, condition: string }[] }>>({});
    private playerConvertedThisTurnSignal = signal<boolean>(false);
    private unitQuadrantBiasSignal = signal<Map<string, { quadrant: number; until: number }>>(new Map());
    private aiUnitTimeNearBaseSignal = signal<Map<string, number>>(new Map());
    private aiBatchingActions: boolean = false;
    private isAiThinking: boolean = false;
    private aggressionModeSignal = signal<boolean>(false);
    private wallCooldownSignal = signal<Map<string, number>>(new Map());
    private aiQueuedUnitIdSignal = signal<string | null>(null);
    private aiMoodSignal = signal<AggressionAiMode>('none');
    private rageCaptureCounterSignal = signal<number>(0);
    private anchoredGatherersSignal = signal<Set<string>>(new Set<string>());
    private totalWarModeSignal = signal<boolean>(false);
    private aiInvalidActionCountSignal = signal<number>(0);
    private aiLastRejectedActionKeySignal = signal<string | null>(null);
    private sandboxSpawnPendingSignal = signal<{ owner: Owner; tier: number } | null>(null);
    private unitMoveOffsetSignal = signal<Map<string, { dx: number; dy: number }>>(new Map());
    private movingUnitsSignal = signal<Set<string>>(new Set());
    private attackingUnitsSignal = signal<Set<string>>(new Set());

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
    sandboxSpawnPending(): { owner: Owner; tier: number } | null {
        return this.sandboxSpawnPendingSignal();
    }
    getMoveOffsetFor(id: string): { dx: number; dy: number } | null {
        const m = this.unitMoveOffsetSignal();
        return m.get(id) ?? null;
    }
    isUnitMoving(id: string): boolean {
        return this.movingUnitsSignal().has(id);
    }
    isUnitAttacking(id: string): boolean {
        return this.attackingUnitsSignal().has(id);
    }
    getCombinedTransform(id: string): string {
        const n = this.attackerNudgeSignal();
        const off = this.getMoveOffsetFor(id);
        const dx = (n && n.id === id ? n.dx : 0) + (off ? off.dx : 0);
        const dy = (n && n.id === id ? n.dy : 0) + (off ? off.dy : 0);
        return `translate(${dx}px, ${dy}px)`;
    }
    aggressionMode(): boolean {
        return this.aggressionModeSignal();
    }
    totalWarMode(): boolean {
        return this.totalWarModeSignal();
    }
    isAnchoredGatherer(id: string): boolean {
        return this.anchoredGatherersSignal().has(id);
    }
    private anchorGatherer(id: string) {
        const next = new Set(this.anchoredGatherersSignal());
        next.add(id);
        this.anchoredGatherersSignal.set(next);
    }
    unanchorGatherer(id: string) {
        const next = new Set(this.anchoredGatherersSignal());
        next.delete(id);
        this.anchoredGatherersSignal.set(next);
    }
    queuedUnitId(): string | null {
        return this.aiQueuedUnitIdSignal();
    }
    currentMood(): AggressionAiMode {
        return this.aiMoodSignal();
    }
    isAngry(): boolean {
        return this.aiMoodSignal() === 'angry';
    }
    isRage(): boolean {
        return this.aiMoodSignal() === 'rage';
    }

    readonly selectedUnit = computed(() =>
        this.unitsSignal().find(u => u.id === this.selectedUnitIdSignal()) || null
    );

    readonly validMoves = computed(() => {
        const unit = this.selectedUnit();
        if (!unit) return [];
        if (unit.hasActed) return [];
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
        if (gs <= 10) return 6;
        if (gs <= 20) return 4;
        return 2;
    }
    get iconSizePx(): number {
        const gs = this.gridSize;
        if (gs <= 10) return 16;
        if (gs <= 20) return 12;
        return 8;
    }
    get tileUnitSizePx(): number {
        return Math.round(this.tileSizePx * 0.75);
    }
    getForestControl() {
        const total = this.forestsSignal().length;
        const player = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y)).length;
        const ai = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
        return { total, player, ai };
    }

    constructor(private combat: CombatService, private build: BuildService, private log: LogService, private settings: SettingsService, private map: MapService, private economy: EconomyService, private aiStrategy: AiStrategyService, private firebase: FirebaseService, private playerName: PlayerNameService) {
        this.loadHighScores();
        this.resetGame();
    }

    resetGame() {
        const difficulty = this.settings.difficulty();
        this.unitsSignal.set([]);
        this.wallCooldownSignal.set(new Map());
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
        this.baseHealthSignal.set(this.settings.customMode() ? { player: 1000, ai: 1000 } : { player: 100, ai: 100 });

        // START RESERVE
        if (difficulty === 'baby') {
            this.reservePointsSignal.set({ player: 5, ai: 5 });
        } else if (difficulty === 'normal') {
            this.reservePointsSignal.set({ player: 1, ai: 1 });
        } else if (difficulty === 'hard') {
            this.reservePointsSignal.set({ player: 1, ai: 3 });
        } else {
            this.reservePointsSignal.set({ player: 1, ai: 5 });
        }

        this.deployTargetsSignal.set([]);
        this.forestsSignal.set(this.map.generateForests(this.gridSize, this.getBasePosition('player'), this.getBasePosition('ai')));
        const forestKeys = new Set(this.forestsSignal().map(p => `${p.x},${p.y}`));
        this.playerExploredSignal.set(new Set(forestKeys));
        this.aiExploredSignal.set(new Set(forestKeys));
        this.wallsSignal.set([]);
        this.placeNeutralWalls();
        this.baseDeployActiveSignal.set(false);
        this.buildModeSignal.set(false);
        this.fogDebugDisabledSignal.set(false);
        this.wallBuiltThisTurnSignal.set(false);
        this.spawnStarterArmy('player');
        this.spawnStarterArmy('ai');
        this.recomputeVisibility();
        // Ensure the current side's units are ready to act at game start
        this.startSideTurn(this.activeSideSignal());
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
        if (unit.hasActed) return;

        const isValid = this.validMoves().some(p => p.x === target.x && p.y === target.y);
        if (!isValid) return;

        this.executeMove(unit, target);
    }

    private executeMove(unit: Unit, target: Position) {
        if (unit.hasActed) return;
        let consumeTurn = false;
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

            const wallCheck = this.combat.checkWallAlongPath(start, target, movingUnit.owner, (x1, y1, x2, y2) => this.getWallBetween(x1, y1, x2, y2));
            if (wallCheck.hitOwn) {
                return updatedUnits;
            }
            if (wallCheck.hitEnemy) {
                const lastFrom = wallCheck.lastFrom!;
                const wall = this.getWallBetween(lastFrom.x, lastFrom.y, target.x, target.y)!;
                {
                    const maxH = wall.maxHealth ?? 100;
                    const damageAbs = this.combat.getWallHitAmount(movingUnit.tier);
                    const nextHealth = Math.max(0, wall.health - damageAbs);
                    this.wallsSignal.update(ws =>
                        ws
                            .map(w =>
                                w.id === wall.id
                                    ? { ...w, health: nextHealth }
                                    : w
                            )
                            .filter((w: any) => (w.health ?? w.hitsRemaining ?? 0) > 0)
                    );
                    const ownerText = wall.owner === 'neutral' ? 'Neutral' : (wall.owner === 'player' ? 'Player' : 'AI');
                    this.appendLog(`[Combat] Tier ${movingUnit.tier} Unit attacked ${ownerText} Wall. Damage: ${damageAbs}. Wall HP: ${nextHealth}/${maxH}.`);
                }
                this.updateWallFormations();
                this.shakenWallIdSignal.set(wall.id);
                setTimeout(() => this.shakenWallIdSignal.set(null), 200);
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
                    this.shakenUnitIdSignal.set(movingUnit.id);
                    setTimeout(() => this.shakenUnitIdSignal.set(null), 180);
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
                    // Attack lunge for both Player and AI: ping-pong towards target axis
                    {
                        const dxTotal = target.x - start.x;
                        const dyTotal = target.y - start.y;
                        const useX = Math.abs(dxTotal) >= Math.abs(dyTotal);
                        const step = useX ? Math.sign(dxTotal) : Math.sign(dyTotal);
                        const gap = this.wallThicknessPx + 2;
                        const cell = this.tileSizePx + gap;
                        const amp = Math.round(cell * 0.35);
                        const dx = useX ? step * amp : 0;
                        const dy = useX ? 0 : step * amp;
                        const s = new Set(this.attackingUnitsSignal());
                        s.add(movingUnit.id);
                        this.attackingUnitsSignal.set(s);
                        this.attackerNudgeSignal.set({ id: movingUnit.id, dx, dy });
                        setTimeout(() => {
                            this.attackerNudgeSignal.set({ id: movingUnit.id, dx: 0, dy: 0 });
                        }, 100);
                        setTimeout(() => {
                            this.attackerNudgeSignal.set(null);
                            const s2 = new Set(this.attackingUnitsSignal());
                            s2.delete(movingUnit.id);
                            this.attackingUnitsSignal.set(s2);
                        }, 200);
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
                    movingUnit.hasActed = true;
                    // Update the unit in the array
                    const idx = updatedUnits.findIndex(u => u.id === movingUnit.id);
                    if (idx !== -1) updatedUnits[idx] = movingUnit;
                    if (movingUnit.owner === 'ai' && movingUnit.tier < 3 && this.isForest(target.x, target.y)) {
                        this.aiStrategy.setGoal(movingUnit.id, { x: target.x, y: target.y });
                        if (movingUnit.tier <= 2) {
                            this.anchorGatherer(movingUnit.id);
                        }
                    }
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

        // Smooth movement offset: render at target tile with offset back to start, then animate to zero
        const dxTiles = target.x - unit.position.x;
        const dyTiles = target.y - unit.position.y;
        const gap = this.wallThicknessPx + 2;
        const cell = this.tileSizePx + gap;
        const off = { dx: -dxTiles * cell, dy: -dyTiles * cell };
        if (dxTiles !== 0 || dyTiles !== 0) {
            const offMap = new Map(this.unitMoveOffsetSignal());
            offMap.set(unit.id, off);
            this.unitMoveOffsetSignal.set(offMap);
            const moving = new Set(this.movingUnitsSignal());
            moving.add(unit.id);
            this.movingUnitsSignal.set(moving);
            setTimeout(() => {
                const m2 = new Map(this.unitMoveOffsetSignal());
                m2.set(unit.id, { dx: 0, dy: 0 });
                this.unitMoveOffsetSignal.set(m2);
                setTimeout(() => {
                    const m3 = new Map(this.unitMoveOffsetSignal());
                    m3.delete(unit.id);
                    this.unitMoveOffsetSignal.set(m3);
                    const s = new Set(this.movingUnitsSignal());
                    s.delete(unit.id);
                    this.movingUnitsSignal.set(s);
                }, 180);
            }, 0);
        }

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
            // Do not auto-end turn; manual progression controls turn flow
        }
        const sel = this.selectedUnitIdSignal();
        if (sel && !this.unitsSignal().some(u => u.id === sel)) {
            this.selectedUnitIdSignal.set(null);
        }
        this.recomputeVisibility();
        // Auto-Focus Next Unit (UX Hard Fix)
        if (unit.owner === 'player') {
            this.selectNextAvailableUnit();
        }
    }

    selectNextAvailableUnit() {
        const units = this.unitsSignal();
        const candidates = units.filter(u => u.owner === 'player' && !u.hasActed);

        if (candidates.length === 0) {
            this.selectUnit(null);
            return;
        }

        // Priority Queue: Mobile (not on forest) first, then Forest occupants
        candidates.sort((a, b) => {
            const aForest = this.isForest(a.position.x, a.position.y) ? 1 : 0;
            const bForest = this.isForest(b.position.x, b.position.y) ? 1 : 0;
            return aForest - bForest; // 0 (Mobile) < 1 (Forest)
        });

        this.selectUnit(candidates[0].id);
    }

    // --- Helper Methods ---

    private calculateTotalPoints(unit: Unit): number {
        return this.combat.calculateTotalPoints(unit);
    }

    private calculateTierAndLevel(points: number): { tier: number, level: number } {
        return this.combat.calculateTierAndLevel(points);
    }

    // --- NEW AI HELPERS ---

    private isUnitInDanger(unit: Unit): boolean {
        const neighbors = this.getNeighbors(unit.position);
        for (const nb of neighbors) {
            const enemy = this.getUnitAt(nb.x, nb.y);
            if (enemy && enemy.owner !== unit.owner) {
                if (this.calculateTotalPoints(enemy) > this.calculateTotalPoints(unit)) {
                    return true;
                }
            }
        }
        return false;
    }

    private findSafeMove(unit: Unit, validMoves: Position[]): Position | null {
        const aiBase = this.getBasePosition('ai');
        if (validMoves.length === 0) return null;
        return validMoves.reduce((best, m) => {
            const d = Math.abs(m.x - aiBase.x) + Math.abs(m.y - aiBase.y);
            const dBest = Math.abs(best.x - aiBase.x) + Math.abs(best.y - aiBase.y);
            return d < dBest ? m : best;
        }, validMoves[0]);
    }

    private findResourceTarget(unit: Unit, context: TurnContext): Position | null {
        const forests = this.forestsSignal();

        // Filter out forests already claimed by other AI agents in this turn
        // And filter out forests already occupied by other AI units (we don't need to go there)
        const availableForests = forests.filter(f => {
            const key = `${f.x},${f.y}`;
            if (context.claimedTargets.has(key)) return false;
            const u = this.getUnitAt(f.x, f.y);
            if (u && u.owner === 'ai') return false; // Already held by AI
            return true;
        });

        // 1. Truly Empty Forests (Priority 1: Expansion)
        const emptyForests = availableForests.filter(f => !this.getUnitAt(f.x, f.y));

        if (emptyForests.length > 0) {
            emptyForests.sort((a, b) => {
                const da = Math.abs(a.x - unit.position.x) + Math.abs(a.y - unit.position.y);
                const db = Math.abs(b.x - unit.position.x) + Math.abs(b.y - unit.position.y);
                return da - db;
            });
            return emptyForests[0];
        }

        // 2. Strategic Resource Reclamation (Priority 2: Recapture)
        // Rule: Only attack player-held forests if AI Unit Tier >= Player Unit Tier
        const playerForests = availableForests.filter(f => {
            const u = this.getUnitAt(f.x, f.y);
            return u && u.owner === 'player';
        });

        const validReclamation = playerForests.filter(f => {
            const occupier = this.getUnitAt(f.x, f.y);
            // Safety check, though playerForests filter ensures u exists and is player
            return occupier && unit.tier >= occupier.tier;
        });

        if (validReclamation.length > 0) {
            validReclamation.sort((a, b) => {
                const da = Math.abs(a.x - unit.position.x) + Math.abs(a.y - unit.position.y);
                const db = Math.abs(b.x - unit.position.x) + Math.abs(b.y - unit.position.y);
                return da - db;
            });
            return validReclamation[0];
        }

        // 3. Dynamic Re-Targeting (Idle/Desperation)
        // If no safe targets, target the player's weakest held forest to force conflict
        if (playerForests.length > 0) {
            // Sort primarily by Occupier Tier (Weakest first), then by distance
            playerForests.sort((a, b) => {
                const uA = this.getUnitAt(a.x, a.y);
                const uB = this.getUnitAt(b.x, b.y);
                const tierA = uA ? uA.tier : 99;
                const tierB = uB ? uB.tier : 99;
                if (tierA !== tierB) return tierA - tierB;

                const da = Math.abs(a.x - unit.position.x) + Math.abs(a.y - unit.position.y);
                const db = Math.abs(b.x - unit.position.x) + Math.abs(b.y - unit.position.y);
                return da - db;
            });
            return playerForests[0];
        }

        return null;
    }

    private findDefensiveWallTarget(unit: Unit): Position | null {
        const neighbors = this.getNeighbors(unit.position);
        const playerUnits = this.unitsSignal().filter(u => u.owner === 'player');

        // Find nearby threats (within 5 tiles)
        const nearbyThreats = playerUnits.filter(u =>
            Math.abs(u.position.x - unit.position.x) + Math.abs(u.position.y - unit.position.y) <= 5
        );

        if (nearbyThreats.length === 0) return null;

        // Calculate centroid of threats
        let avgX = 0, avgY = 0;
        nearbyThreats.forEach(t => { avgX += t.position.x; avgY += t.position.y; });
        avgX /= nearbyThreats.length;
        avgY /= nearbyThreats.length;

        // Score neighbors
        let bestTarget: Position | null = null;
        let bestScore = -Infinity;

        for (const nb of neighbors) {
            // Check if can build wall (no wall exists)
            if (this.getWallBetween(unit.position.x, unit.position.y, nb.x, nb.y)) continue;
            // Check build validity (simplified: not safe zone, in bounds)
            if (this.isInNoBuildZone(unit.position) || this.isInNoBuildZone(nb)) continue;
            // Also check if edge is on cooldown
            if (this.isEdgeOnCooldown(unit.position, nb)) continue;

            // Score: Dot product logic (closer to threat centroid is better)
            const dx = nb.x - unit.position.x;
            const dy = nb.y - unit.position.y;
            const tx = avgX - unit.position.x;
            const ty = avgY - unit.position.y;

            const dot = dx * tx + dy * ty;

            if (dot > bestScore) {
                bestScore = dot;
                bestTarget = nb;
            }
        }

        return bestScore > 0 ? bestTarget : null;
    }

    private getNextStepTowards(unit: Unit, target: Position, validMoves: Position[]): Position | null {
        if (validMoves.length === 0) return null;
        let best = null;
        let minDist = Infinity;

        for (const m of validMoves) {
            const d = Math.abs(m.x - target.x) + Math.abs(m.y - target.y);
            if (d < minDist) {
                minDist = d;
                best = m;
            }
        }
        return best;
    }

    private findCombatTarget(unit: Unit, context: TurnContext, validMoves: Position[]): Position | null {
        // 1. Priority Targets (High Value Units)
        const reachableThreats = context.priorityTargets.filter(t =>
            validMoves.some(m => m.x === t.position.x && m.y === t.position.y)
        );
        if (reachableThreats.length > 0) return reachableThreats[0].position;

        // 2. Adjacent Walls (Breacher Logic)
        // Identify walls that are blocking or hostile
        const neighbors = this.getNeighbors(unit.position);
        for (const nb of neighbors) {
            const wall = this.getWallBetween(unit.position.x, unit.position.y, nb.x, nb.y);
            if (wall && wall.owner !== 'ai') {
                // Return the tile across the wall as the target.
                // executeMove will detect the wall intersection and trigger an attack.
                return nb;
            }
        }

        // 3. General Enemies
        const attackMoves = validMoves.filter(m => {
            const u = this.getUnitAt(m.x, m.y);
            return u && u.owner !== unit.owner;
        });

        if (attackMoves.length > 0) {
            return attackMoves[0];
        }

        return null;
    }

    private findFallbackMove(unit: Unit, validMoves: Position[], targetBase: Position): Position | null {
        if (validMoves.length === 0) return null;

        const currentDist = Math.abs(unit.position.x - targetBase.x) + Math.abs(unit.position.y - targetBase.y);

        // Aggressive Pathfinding: Filter moves that move FORWARD (decrease distance)
        // Or Lateral (equal distance) if forward is blocked?
        // Actually, just sorting by distance works for "Forward Weight", but we must penalize Backward.

        // Find best move based on distance
        let best = null;
        let minDist = Infinity;

        for (const m of validMoves) {
            const d = Math.abs(m.x - targetBase.x) + Math.abs(m.y - targetBase.y);
            if (d < minDist) {
                minDist = d;
                best = m;
            }
        }

        if (!best) return null;

        // Constraint: Only allow Backward (minDist > currentDist) if Critical Threat
        // Backward means we are moving AWAY from the target (retreating)
        if (minDist > currentDist) {
            // Check for Critical Threat (Higher Tier Enemy)
            // Note: isUnitInDanger checks for ANY stronger enemy adjacent.
            const inDanger = this.isUnitInDanger(unit);

            // We need to confirm if the danger is from a Higher Tier enemy (Critical)
            let isCritical = false;
            if (inDanger) {
                const neighbors = this.getNeighbors(unit.position);
                isCritical = neighbors.some(nb => {
                    const u = this.getUnitAt(nb.x, nb.y);
                    return u && u.owner !== unit.owner && u.tier > unit.tier;
                });
            }

            if (!isCritical) {
                // If not in critical danger, do NOT retreat.
                // This might mean we return null (hold position) if forward/lateral is blocked.
                return null;
            }
        }

        return best;
    }

    private getNeighbors(pos: Position): Position[] {
        return [
            { x: pos.x + 1, y: pos.y },
            { x: pos.x - 1, y: pos.y },
            { x: pos.x, y: pos.y + 1 },
            { x: pos.x, y: pos.y - 1 }
        ].filter(p => this.inBounds(p.x, p.y));
    }

    private bfsPath(start: Position, target: Position, opts?: { respectWalls?: boolean; avoidFriendlyUnits?: boolean }): Position[] | null {
        const q: { pos: Position; path: Position[] }[] = [{ pos: start, path: [start] }];
        const visited = new Set<string>();
        visited.add(`${start.x},${start.y}`);

        let iter = 0;
        // Limit search depth/iterations for performance
        while (q.length > 0 && iter < 500) {
            iter++;
            const curr = q.shift()!;
            if (curr.pos.x === target.x && curr.pos.y === target.y) {
                return curr.path;
            }

            const neighbors = this.getNeighbors(curr.pos);
            for (const nb of neighbors) {
                const key = `${nb.x},${nb.y}`;
                if (!visited.has(key)) {
                    if (opts?.avoidFriendlyUnits) {
                        const u = this.getUnitAt(nb.x, nb.y);
                        if (u && u.owner === 'ai') continue;
                    }
                    if (opts?.respectWalls) {
                        const w = this.getWallBetween(curr.pos.x, curr.pos.y, nb.x, nb.y);
                        if (w) continue;
                    }
                    visited.add(key);
                    q.push({ pos: nb, path: [...curr.path, nb] });
                }
            }
        }
        return null;
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
            if (this.settings.customMode()) {
                this.endReasonSignal.set('Match Finished (Custom Mode)');
            } else {
                this.recordHighScore('player wins', 'destroy');
            }
        } else if (hp.player <= 0) {
            this.gameStatusSignal.set('jaerbi wins');
            this.screenShakeSignal.set(true);
            setTimeout(() => {
                this.screenShakeSignal.set(false);
                this.endOverlaySignal.set(true);
            }, 1000);
            const playerBase = this.getBasePosition('player');
            this.queueCombatText('💥', playerBase);
            if (this.settings.customMode()) {
                this.endReasonSignal.set('Match Finished (Custom Mode)');
            } else {
                this.recordHighScore('jaerbi wins', 'destroy');
            }
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
    highScoresOpen(): boolean {
        return this.highScoresOpenSignal();
    }
    supportOpen(): boolean {
        return this.supportOpenSignal();
    }
    toggleHighScores() {
        this.highScoresOpenSignal.update(v => !v);
    }
    closeHighScores() {
        this.highScoresOpenSignal.set(false);
    }
    toggleLeaderboard() {
        this.leaderboardOpenSignal.update(v => !v);
    }
    closeLeaderboard() {
        this.leaderboardOpenSignal.set(false);
    }
    toggleSupport() {
        this.supportOpenSignal.update(v => !v);
    }
    closeSupport() {
        this.supportOpenSignal.set(false);
    }
    copySupportLink(url: string) {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url);
            }
        } catch { }
    }
    getHighScoresForCurrentCombo(): { wins: { turns: number; date: number; condition: string }[]; losses: { turns: number; date: number; condition: string }[] } {
        const key = `${this.settings.difficulty()}|${this.settings.mapSize()}`;
        const store = this.highScoresSignal();
        return store[key] ?? { wins: [], losses: [] };
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
    leaderboardOpen(): boolean {
        return this.leaderboardOpenSignal();
    }
    isNamePromptOpen(): boolean {
        return this.namePromptOpenSignal();
    }
    getPlayerName(): string {
        const user = this.firebase.user$();
        if (user?.displayName) {
            return user.displayName;
        }
        return this.playerName.name();
    }
    confirmAndSaveScore(name: string) {
        if (this.settings.customMode()) {
            return;
        }
        this.playerName.setName(name);
        const pending = this.pendingScoreSignal();
        if (pending) {
            const user = this.firebase.user$();
            const payload: ScoreEntry = {
                ...pending,
                playerName: this.playerName.name(),
                userId: user?.uid,
                userPhoto: user?.photoURL ?? undefined
            };
            this.firebase.saveHighScore(payload);
            this.pendingScoreSignal.set(null);
            this.namePromptOpenSignal.set(false);
        }
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
    /**
     * Returns remaining turns in the 10-turn Forest Monopoly countdown for the current controller.
     * Logic:
     * - Computes total forests and per-owner occupation counts.
     * - If an owner holds all forests at once, returns 10 minus that owner's consecutive control counter.
     * - Otherwise, returns 0 (no active countdown).
     * Note:
     * - Countdown increments in updateForestMonopoly() at end of player phase.
     * - UI should pulse when this value ≤ 3 to warn of imminent victory.
     */
    monopolyTurnsLeft(): number {
        const total = this.forestsSignal().length;
        if (total === 0) return 0;
        const playerHeld = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y)).length;
        const aiHeld = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
        const playerMajority = playerHeld / total === 1;
        const aiMajority = aiHeld / total === 1;
        if (playerMajority) return Math.max(0, 10 - this.forestMonopolySignal().player);
        if (aiMajority) return Math.max(0, 10 - this.forestMonopolySignal().ai);
        return 0;
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
    shouldRenderWall(tile1: Position, tile2: Position, owner?: 'player' | 'ai' | 'neutral'): boolean {
        const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
        if (!wall) return false;
        const ow = owner ?? wall.owner;
        if (ow === 'player') return true;
        if (this.fogDebugDisabledSignal()) return true;
        return this.isVisibleToPlayer(tile1.x, tile1.y) || this.isVisibleToPlayer(tile2.x, tile2.y);
    }
    hoverFormationById(id: string | undefined | null) {
        this.hoveredFormationIdSignal.set(id ?? null);
    }
    isFormationHovered(id?: string | null): boolean {
        if (!id) return false;
        return this.hoveredFormationIdSignal() === id;
    }
    getFormationInfo(id: string | null | undefined): { size: number; bonus: number } | null {
        const fid = id ?? null;
        if (!fid) return null;
        const w = this.wallsSignal().find(x => x.formationId === fid);
        if (!w) return null;
        return { size: w.formationSize ?? 1, bonus: w.bonusHp ?? 0 };
    }
    updateWallFormations() {
        const wallsAll = this.wallsSignal();
        if (wallsAll.length === 0) return;
        const byId = new Map<string, Wall>();
        const byNode = new Map<string, string[]>();
        for (const w of wallsAll) {
            byId.set(w.id, w);
            const k1 = `${w.tile1.x},${w.tile1.y}`;
            const k2 = `${w.tile2.x},${w.tile2.y}`;
            const arr1 = byNode.get(k1) ?? [];
            arr1.push(w.id);
            byNode.set(k1, arr1);
            const arr2 = byNode.get(k2) ?? [];
            arr2.push(w.id);
            byNode.set(k2, arr2);
        }
        const visited = new Set<string>();
        const groups: string[][] = [];
        for (const w of wallsAll) {
            if (visited.has(w.id)) continue;
            // // Skip neutral walls for grouping
            if (w.owner === 'neutral') {
                groups.push([w.id]);
                visited.add(w.id);
                continue;
            }
            const q: string[] = [w.id];
            visited.add(w.id);
            const group: string[] = [];
            const owner = w.owner;
            while (q.length > 0) {
                const id = q.shift()!;
                group.push(id);
                const curr = byId.get(id)!;
                const nodes = [`${curr.tile1.x},${curr.tile1.y}`, `${curr.tile2.x},${curr.tile2.y}`];
                for (const nk of nodes) {
                    const neighbors = byNode.get(nk) ?? [];
                    for (const nid of neighbors) {
                        if (!visited.has(nid)) {
                            const neighborWall = byId.get(nid)!;
                            // Strict touch and owner match; exclude neutral
                            if (neighborWall.owner === owner) {
                                visited.add(nid);
                                q.push(nid);
                            }
                        }
                    }
                }
            }
            groups.push(group);
        }
        const nextWalls = wallsAll.map(w => ({ ...w }));
        const idxById = new Map<string, number>();
        for (let i = 0; i < nextWalls.length; i++) idxById.set(nextWalls[i].id, i);
        for (const group of groups) {
            const any = byId.get(group[0])!;
            const isNeutralGroup = any.owner === 'neutral';
            const size = isNeutralGroup ? 1 : group.length;
            const bonus = isNeutralGroup ? 0 : Math.min(80, Math.max(0, (size - 1) * 20));
            const newMax = 100 + bonus;
            const formationId = isNeutralGroup ? null : group[0];
            for (const id of group) {
                const i = idxById.get(id)!;
                const w = nextWalls[i];
                const oldMax = w.maxHealth ?? 100;
                const bonusDiff = newMax - oldMax;
                let newHealth = w.health;
                if (bonusDiff > 0) {
                    newHealth = w.health + bonusDiff;
                } else if (bonusDiff < 0) {
                    newHealth = Math.min(w.health, newMax);
                }
                newHealth = Math.max(0, Math.min(newMax, newHealth));
                nextWalls[i] = { ...w, formationId: formationId ?? undefined, formationSize: size, maxHealth: newMax, bonusHp: bonus, health: newHealth };
            }
        }
        this.wallsSignal.set(nextWalls);
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
    private loadHighScores() {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('highScores');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    this.highScoresSignal.set(parsed);
                }
            }
        } catch { }
    }
    private persistHighScores() {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('highScores', JSON.stringify(this.highScoresSignal()));
        } catch { }
    }
    debugInstantWin() {
        this.turnSignal.set(Math.floor(Math.random() * 10) + 5);
        this.gameStatusSignal.set('player wins');
        this.recordHighScore('player wins', 'destroy');
    }

    debugCycleSettings() {
        const diffs: Difficulty[] = ['baby', 'normal', 'hard', 'nightmare'];
        const sizes: MapSize[] = [10, 20, 30];

        let dIdx = diffs.indexOf(this.settings.difficulty());
        let sIdx = sizes.indexOf(this.settings.mapSize() as MapSize);

        dIdx++;
        if (dIdx >= diffs.length) {
            dIdx = 0;
            sIdx++;
            if (sIdx >= sizes.length) {
                sIdx = 0;
            }
        }

        this.settings.setDifficulty(diffs[dIdx]);
        this.settings.setMapSize(sizes[sIdx]);
        this.resetGame();
    }

    private recordHighScore(result: 'player wins' | 'jaerbi wins', condition: 'monopoly' | 'destroy') {
        if (this.settings.customMode()) {
            this.endReasonSignal.set('Match Finished (Custom Mode)');
            return;
        }
        const key = `${this.settings.difficulty()}|${this.settings.mapSize()}`;
        const current = { ...this.highScoresSignal() };
        const entry = { turns: this.turnSignal(), date: Date.now(), condition };
        const bucket = current[key] ?? { wins: [], losses: [] };
        if (result === 'player wins') {
            bucket.wins = [...bucket.wins, entry].sort((a, b) => a.turns - b.turns).slice(0, 3);
        } else {
            bucket.losses = [...bucket.losses, entry].sort((a, b) => a.turns - b.turns).slice(0, 3);
        }
        current[key] = bucket;
        this.highScoresSignal.set(current);
        this.persistHighScores();
        const ctrl = this.getForestControl();
        const forestsCaptured = result === 'player wins' ? ctrl.player : ctrl.ai;
        const victoryType: ScoreEntry['victoryType'] = condition === 'monopoly' ? 'Monopoly' : 'Annihilation';
        const basePayload: ScoreEntry = {
            playerName: result === 'player wins' ? this.playerName.name() : 'Jaerbi',
            turnsPlayed: this.turnSignal(),
            forestsCaptured,
            victoryType,
            timestamp: Date.now(),
            difficulty: this.settings.difficulty(),
            mapSize: this.settings.mapSize() as MapSize,
            victory: result === 'player wins'
        };
        if (result === 'player wins') {
            this.pendingScoreSignal.set(basePayload);
            this.namePromptOpenSignal.set(true);
        } else {
            this.firebase.saveHighScore(basePayload);
        }
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
        const start = unit.position;
        const inBounds = (p: Position) => p.x >= 0 && p.x < this.gridSize && p.y >= 0 && p.y < this.gridSize;

        const tryStep = (from: Position, to: Position): 'blocked' | 'empty' | 'ally' | 'enemy' => {
            if (!inBounds(to)) return 'blocked';
            if (from.x === to.x || from.y === to.y) {
                const wall = this.getWallBetween(from.x, from.y, to.x, to.y);
                if (wall) return 'blocked';
            } else {
                if (this.isDiagonalBlocked(from, to)) return 'blocked';
            }
            const u = this.getUnitAt(to.x, to.y);
            if (!u) return 'empty';
            return u.owner === unit.owner ? 'ally' : 'enemy';
        };

        const addStop = (to: Position, stopType: 'empty' | 'ally' | 'enemy') => {
            if (stopType === 'empty') {
                moves.push(to);
            } else if (stopType === 'enemy') {
                moves.push(to);
            } else {
                if (this.getUnitAt(to.x, to.y)?.tier === unit.tier) {
                    moves.push(to);
                }
            }
        };

        const orthDirs = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
        ];
        const diagDirs = [
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
        ];

        if (unit.tier === 1) {
            for (const d of orthDirs) {
                const to = { x: start.x + d.x, y: start.y + d.y };
                const res = tryStep(start, to);
                if (res !== 'blocked') addStop(to, res);
            }
            return moves;
        }

        for (const d of orthDirs) {
            const to1 = { x: start.x + d.x, y: start.y + d.y };
            const r1 = tryStep(start, to1);
            if (r1 !== 'blocked') addStop(to1, r1);
            if (unit.tier === 3 && r1 === 'empty') {
                const to2 = { x: start.x + d.x * 2, y: start.y + d.y * 2 };
                const r2 = tryStep(to1, to2);
                if (r2 !== 'blocked') addStop(to2, r2);
            }
        }

        for (const d of diagDirs) {
            const to1 = { x: start.x + d.x, y: start.y + d.y };
            const r1 = tryStep(start, to1);
            if (r1 !== 'blocked') addStop(to1, r1);
            if (unit.tier === 4 && r1 === 'empty') {
                const to2 = { x: start.x + d.x * 2, y: start.y + d.y * 2 };
                const r2 = tryStep(to1, to2);
                if (r2 !== 'blocked') {
                    addStop(to2, r2);
                    if (r2 === 'empty') {
                        const to3 = { x: start.x + d.x * 3, y: start.y + d.y * 3 };
                        const r3 = tryStep(to2, to3);
                        if (r3 !== 'blocked') addStop(to3, r3);
                    }
                }
            }
        }

        return moves;
    }

    // --- Turn Management ---

    private endTurn() {
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
        const getWoodsResources = (difficulty: Difficulty) => {
            let woodResources: number = 0;
            if (difficulty === 'baby') {
                woodResources = 10;
            } else if (difficulty === 'normal') {
                woodResources = 8;
            } else if (difficulty === 'hard') {
                woodResources = 5;
            } else {
                woodResources = 3;
            }

            return woodResources;
        }
        if (this.gameStatus() === 'playing') {
            const countOnForest = this.unitsSignal().filter(u => u.owner === ownerJustActed && this.isForest(u.position.x, u.position.y) && (u.productionActive ?? false)).length;
            if (countOnForest > 0) {
                if (ownerJustActed === 'player') {
                    // ADD Wood Resources
                    this.resourcesSignal.update(r => ({ wood: r.wood + countOnForest * getWoodsResources(this.settings.difficulty()) }));
                } else {
                    this.aiWoodSignal.update(w => w + countOnForest * getWoodsResources(this.settings.difficulty()));
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
            const aiBonus = this.settings.getAiReserveBonus(this.turnSignal());
            this.reservePointsSignal.update(r => ({ player: r.player + 1, ai: r.ai + aiBonus }));
        } else {
            if (this.autoDeployEnabledSignal() && this.playerConvertedThisTurnSignal() && this.reservePointsSignal().player > 0) {
                this.autoDeployFromReserves();
                this.playerConvertedThisTurnSignal.set(false);
            }
        }
        this.activeSideSignal.set(nextSide);
        // Reset per-unit action flags at the start of next side's turn
        this.startSideTurn(nextSide);
        if (nextSide === 'ai' && this.gameStatus() === 'playing') {
            setTimeout(() => this.aiTurn(), 10);
        }
    }
    endPlayerTurn() {
        if (this.activeSideSignal() !== 'player' || this.gameStatus() !== 'playing') return;
        this.endTurn();
    }
    private startSideTurn(owner: Owner) {
        this.unitsSignal.update(units =>
            units.map(u => (u.owner === owner ? { ...u, hasActed: false } : u))
        );
        if (owner === 'player') {
            this.selectNextAvailableUnit();
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
        const playerMajority = playerHeld / total === 1;
        const aiMajority = aiHeld / total === 1;
        if (playerMajority) {
            const next = { ...this.forestMonopolySignal() };
            next.player = next.player + 1;
            next.ai = 0;
            this.forestMonopolySignal.set(next);
            if (next.player >= 10) {
                this.gameStatusSignal.set('player wins');
                this.screenShakeSignal.set(true);
                this.endReasonSignal.set(this.settings.t('ECONOMIC_DOMINATION_GREETING'));
                setTimeout(() => {
                    this.screenShakeSignal.set(false);
                    this.endOverlaySignal.set(true);
                }, 1000);
                this.recordHighScore('player wins', 'monopoly');
            }
        } else if (aiMajority) {
            const next = { ...this.forestMonopolySignal() };
            next.ai = next.ai + 1;
            next.player = 0;
            this.forestMonopolySignal.set(next);
            if (next.ai >= 10) {
                this.gameStatusSignal.set('jaerbi wins');
                this.screenShakeSignal.set(true);
                this.endReasonSignal.set(this.settings.t('ECONOMIC_DOMINATION_GREETING'));
                setTimeout(() => {
                    this.screenShakeSignal.set(false);
                    this.endOverlaySignal.set(true);
                }, 1000);
                this.recordHighScore('jaerbi wins', 'monopoly');
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
        // console.trace('AI TURN START TRACE');
        this.aiBatchingActions = true;
        const aiBase = this.getBasePosition('ai');
        // console.log('[AI] Phase: Economy');

        // 0. Global Strategy: Fortress Mode
        const aiForests = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
        const fortressMode = aiForests > 3;
        if (fortressMode) {
            // console.log('[AI] FORTRESS MODE ACTIVE');
        }

        {
            let iter = 0;
            const maxIter = 50;
            // Reserve Rule: Keep 50 Wood untouchable (UNLESS Emergency: Base HP < 50%)
            const baseHp = this.baseHealthSignal().ai;
            const threshold = baseHp < 50 ? 20 : 70;

            while (this.aiWoodSignal() > threshold) {
                iter++;
                if (iter > maxIter) {
                    try { console.warn('[AI] Economy convert safety break'); } catch { }
                    break;
                }
                this.aiConvertWoodToReserve();
            }
        }
        // Adaptive internal difficulty (stealth)
        try {
            const totalForests = this.forestsSignal().length;
            const aiForests = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
            const playerForests = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y)).length;
            const baseDifficulty = this.settings.difficulty();
            const playerPct = totalForests > 0 ? playerForests / totalForests : 0;

            // Check AI mode 
            let mood: AggressionAiMode = 'none';
            if (playerForests <= aiForests) {
                mood = 'none';
            } else if (playerPct >= 0.9 || playerForests >= 9) {
                mood = 'rage';
            } else if (playerForests >= aiForests + ((baseDifficulty === 'baby') ? 4 : (baseDifficulty === 'normal') ? 3 : (baseDifficulty === 'hard') ? 2 : 1)) {
                mood = 'angry';
            } else {
                mood = 'none';
            }
            this.aiMoodSignal.set(mood);

            // Adding a bonus based on the situation
            const isEvenTurn = this.turnSignal() % 2 === 0;
            const isFifthTurn = this.turnSignal() % 5 === 0;
            const aiPct = totalForests > 0 ? aiForests / totalForests : 0;
            const prevTW = this.totalWarModeSignal();
            const nextTW = aiPct >= 0.65;
            if (!prevTW && nextTW) {
                try { console.log('[AI MODE] TOTAL_WAR_MODE engaged'); } catch { }
            }
            this.totalWarModeSignal.set(nextTW);
            if (mood === 'rage') {
                const reserveHelp: number = (baseDifficulty === 'baby')
                    ? (isEvenTurn ? 1 : 2)
                    : (baseDifficulty === 'normal')
                        ? (isEvenTurn ? 3 : 2)
                        : (baseDifficulty === 'hard')
                            ? (isEvenTurn ? 4 : 3) : 4;
                this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai + reserveHelp }));
            } else if (mood === 'angry') {
                if (baseDifficulty === 'baby') {
                    if (isFifthTurn) {
                        const reserveHelp = 1;
                        this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai + reserveHelp }));
                    }
                } else {
                    if (isEvenTurn) {
                        const reserveHelp = (baseDifficulty === 'normal')
                            ? (isEvenTurn ? 1 : 0)
                            : (baseDifficulty === 'hard')
                                ? (isFifthTurn ? 2 : 1) : 2;
                        this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai + reserveHelp }));
                    }
                }
            }
        } catch { }
        if (this.turnSignal() <= 10) {
            let made = 0;
            const cost1 = this.getPointsForTierLevel(1, 1);
            while (this.reservePointsSignal().ai >= cost1 && made < 2) {
                const created = this.aiSpawnTier(1, 1, new Set<string>());
                if (created === 0) break;
                made++;
                await new Promise(r => setTimeout(r, 60));
            }
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
        for (const unit of currentAiUnits) {
            const onForest = this.isForest(unit.position.x, unit.position.y);
            if (unit.owner === 'ai' && onForest && unit.tier <= 2) {
                this.anchorGatherer(unit.id);
            }
        }
        const playerIncome = this.unitsSignal().filter(u => u.owner === 'player' && this.isForest(u.position.x, u.position.y) && (u.productionActive ?? false)).length * 2;
        const aiIncome = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y) && (u.productionActive ?? false)).length * 2;
        const aggression = playerIncome >= aiIncome;
        this.aggressionModeSignal.set(aggression);
        // console.log(`[AI Economy] Player Income: ${playerIncome}, AI Income: ${aiIncome}. AGGRESSION MODE: ${aggression}`);
        const forestsAll = this.forestsSignal();
        const unoccupied = forestsAll.filter(f => !this.getUnitAt(f.x, f.y));
        const visibleFree = unoccupied.filter(f => this.isVisibleToAi(f.x, f.y));
        const aiUnitsList = this.unitsSignal().filter(u => u.owner === 'ai');
        if (this.turnSignal() <= 15) {
            const queued = this.aiQueuedUnitIdSignal();
            const queuedUnit = queued ? aiUnitsList.find(u => u.id === queued) : null;
            const queuedActive = queuedUnit && !this.isForest(queuedUnit.position.x, queuedUnit.position.y) && visibleFree.length > 0;
            if (!queuedActive) {
                const candidates = aiUnitsList.filter(u => u.tier <= 2 && !this.isForest(u.position.x, u.position.y));
                const pick = candidates.length > 0 && visibleFree.length > 0 ? candidates.reduce((acc, u) => {
                    const dU = Math.min(...visibleFree.map(f => Math.abs(u.position.x - f.x) + Math.abs(u.position.y - f.y)));
                    const dA = Math.min(...visibleFree.map(f => Math.abs(acc.position.x - f.x) + Math.abs(acc.position.y - f.y)));
                    return dU < dA ? u : acc;
                }, candidates[0]) : null;
                this.aiQueuedUnitIdSignal.set(pick ? pick.id : null);
            }
        } else {
            this.aiQueuedUnitIdSignal.set(null);
        }
        // Mandatory T3 Hunter Threshold
        try {
            const t3Cost = this.getPointsForTierLevel(3, 1);
            const totalForests = this.forestsSignal().length;
            const aiControlCount = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
            const aiControlPct = totalForests > 0 ? aiControlCount / totalForests : 0;
            const reservesNow = this.reservePointsSignal().ai;
            if (reservesNow >= t3Cost && aiControlPct <= 0.6) {
                this.aiSpawnTier(3, 1, new Set<string>());
            }
        } catch { }
        const threatsBase = this.unitsSignal().filter(u => u.owner === 'player' && Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3 && u.tier >= 2);
        if (threatsBase.length > 0) {
            const highest = threatsBase.reduce((acc, e) => this.calculateTotalPoints(e) > this.calculateTotalPoints(acc) ? e : acc, threatsBase[0]);
            this.aiDefenseSpawn(highest);
        }
        if (!this.wallBuiltThisTurnSignal()) {
            if (this.totalWarModeSignal()) {
                const actions = this.aiStrategy.getWallBuildActions(this);
                for (const act of actions) {
                    if (this.wallBuiltThisTurnSignal()) break;
                    this.aiBuildWallBetween(act.from, act.to);
                }
            } else {
                this.tryDefensiveWallsNearForests();
            }
        }

        // PHASE 1: Free Actions (Loop until no beneficial free actions remain)
        // console.log('[AI] Phase 1: Free Actions (Spawning/Walls/Conversion)');
        let freeActionsTaken = 0;
        const MAX_FREE_ACTIONS = 10; // Safety cap
        while (freeActionsTaken < MAX_FREE_ACTIONS) {
            const performed = this.executeOneFreeAction();
            if (!performed) break;
            freeActionsTaken++;
            await new Promise(r => setTimeout(r, 100)); // Small delay for visualization
        }

        // Clear any queued single-unit focus for multi-action phase
        this.aiQueuedUnitIdSignal.set(null);

        // --- NEW MULTI-AGENT ARCHITECTURE ---
        const playerBase = this.getBasePosition('player');

        // 1. TurnContext (Blackboard)
        const priorityTargets = this.unitsSignal().filter(u =>
            u.owner === 'player' && (
                this.isForest(u.position.x, u.position.y) ||
                Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 4
            )
        );
        const turnContext: TurnContext = {
            claimedTargets: new Set<string>(),
            priorityTargets
        };

        // 2. Unit Sorting (Heavy -> Light)
        const aiUnits = this.unitsSignal().filter(u => u.owner === 'ai' && !u.hasActed);
        const sortedUnits = aiUnits.sort((a, b) => b.tier - a.tier);

        // 3. Unit Loop (Decision Tree)
        for (const unit of sortedUnits) {
            // Refresh unit state
            const currentUnit = this.unitsSignal().find(u => u.id === unit.id);
            if (!currentUnit || currentUnit.hasActed) continue;

            let action: { type: 'move' | 'attack' | 'wall_attack' | 'build_wall'; target: Position; reason: string } | null = null;

            // Valid moves filtered by claimed targets
            const rawMoves = this.calculateValidMoves(currentUnit);
            const validMoves = rawMoves.filter(m => !turnContext.claimedTargets.has(`${m.x},${m.y}`));

            // Step 0: Base Protection (Absolute Priority)
            // Override Fortress Mode/Expansion if base is threatened
            const distToBase = Math.max(Math.abs(currentUnit.position.x - aiBase.x), Math.abs(currentUnit.position.y - aiBase.y));
            const baseThreats = this.unitsSignal().filter(u =>
                u.owner === 'player' &&
                Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3
            );

            if (baseThreats.length > 0 && !this.isForest(currentUnit.position.x, currentUnit.position.y) && distToBase <= 6) {
                // Find closest threat
                const closestThreat = baseThreats.reduce((prev, curr) => {
                    const dPrev = Math.max(Math.abs(prev.position.x - aiBase.x), Math.abs(prev.position.y - aiBase.y));
                    const dCurr = Math.max(Math.abs(curr.position.x - aiBase.x), Math.abs(curr.position.y - aiBase.y));
                    return dCurr < dPrev ? curr : prev;
                });

                // Can we attack it?
                const canAttack = validMoves.some(m => m.x === closestThreat.position.x && m.y === closestThreat.position.y);
                if (canAttack) {
                    action = { type: 'attack', target: closestThreat.position, reason: 'Base Defense: Eliminate Threat' };
                } else {
                    // Move towards it
                    const intercept = this.getNextStepTowards(currentUnit, closestThreat.position, validMoves);
                    if (intercept) {
                        action = { type: 'move', target: intercept, reason: 'Base Defense: Intercept' };
                    }
                }
            }

            // Priority Zero: Hold Position (Forest Occupants)
            if (this.isForest(currentUnit.position.x, currentUnit.position.y)) {
                const rawMoves = this.calculateValidMoves(currentUnit);
                // Check for killable adjacent enemy
                const combatTarget = this.findCombatTarget(currentUnit, turnContext, rawMoves);
                if (combatTarget) {
                    action = { type: 'attack', target: combatTarget, reason: 'Defense: Defend Forest' };
                } else {
                    // Step E (Early Check): Defensive Wall Building
                    // If holding forest, check if we should build a wall (cost 10 wood)
                    if (this.aiWoodSignal() >= 50) {
                        const wallTarget = this.findDefensiveWallTarget(currentUnit);
                        if (wallTarget) {
                            action = { type: 'build_wall', target: wallTarget, reason: 'Defense: Fortify Position' };
                        }
                    }

                    if (!action) {
                        this.appendLog(`[AI Unit ${currentUnit.id.substring(0, 4)}] Holding forest position.`);
                        this.unitsSignal.update(units => units.map(u => u.id === currentUnit.id ? { ...u, hasActed: true } : u));
                        continue;
                    }
                }
            }

            const totalForestsForAggro = this.forestsSignal().length;
            const aiOwnedForestsForAggro = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
            const aiOwnedPctForAggro = totalForestsForAggro > 0 ? aiOwnedForestsForAggro / totalForestsForAggro : 0;
            const isEmergency = currentUnit.tier >= 3 || aiOwnedPctForAggro >= 0.7;
            const distToPlayerBase = Math.max(Math.abs(currentUnit.position.x - playerBase.x), Math.abs(currentUnit.position.y - playerBase.y));
            if (!action && distToPlayerBase < 4) {
                // Ultimate Siege Fix: Weighted decision within siege range; prioritize wall attacks and base hits
                if (isEmergency && distToPlayerBase <= 3) {
                    const candidates: { type: 'move' | 'attack' | 'wall_attack'; target: Position; weight: number; reason: string }[] = [];
                    const canBaseAttack = validMoves.some(m => m.x === playerBase.x && m.y === playerBase.y);
                    if (canBaseAttack) {
                        candidates.push({ type: 'attack', target: playerBase, weight: 1.0, reason: 'Siege: Strike Base' });
                    }
                    const neighbors = this.getNeighbors(currentUnit.position);
                    const currDist = distToPlayerBase;
                    let wallAttackAvailable = false;
                    for (const nb of neighbors) {
                        const w = this.getWallBetween(currentUnit.position.x, currentUnit.position.y, nb.x, nb.y);
                        if (w) {
                            const nbDist = Math.max(Math.abs(nb.x - playerBase.x), Math.abs(nb.y - playerBase.y));
                            if (nbDist < currDist) {
                                candidates.push({ type: 'wall_attack', target: nb, weight: 0.9, reason: 'Siege: Breach (Path to Base)' });
                                wallAttackAvailable = true;
                            }
                        }
                    }
                    const step = this.getNextStepTowards(currentUnit, playerBase, validMoves);
                    if (step) {
                        const stepDist = Math.max(Math.abs(step.x - playerBase.x), Math.abs(step.y - playerBase.y));
                        const allowMove = !wallAttackAvailable ? true : (stepDist < currDist);
                        if (allowMove) {
                            candidates.push({ type: 'move', target: step, weight: 0.5, reason: 'Siege: Advance on Base' });
                        }
                    }
                    if (candidates.length > 0) {
                        candidates.sort((a, b) => b.weight - a.weight);
                        const chosen = candidates[0];
                        action = { type: chosen.type, target: chosen.target, reason: chosen.reason };
                        if (chosen.type === 'move' && wallAttackAvailable) {
                            this.appendLog(`[AI Debug] Unit at (${currentUnit.position.x},${currentUnit.position.y}) chose Move over Wall Attack. Weights: wall=0.9, move=${chosen.weight}`);
                        }
                    }
                }
                if (!action) {
                    const canBaseAttack = validMoves.some(m => m.x === playerBase.x && m.y === playerBase.y);
                    if (canBaseAttack) {
                        action = { type: 'attack', target: playerBase, reason: 'Siege: Strike Base' };
                    } else {
                        const step = this.getNextStepTowards(currentUnit, playerBase, validMoves);
                        if (step) {
                            const w = this.getWallBetween(currentUnit.position.x, currentUnit.position.y, step.x, step.y);
                            if (w) {
                                action = { type: 'wall_attack', target: step, reason: 'Siege: Breach' };
                            } else {
                                action = { type: 'move', target: step, reason: 'Siege: Advance on Base' };
                            }
                        } else {
                            const path = this.bfsPath(currentUnit.position, playerBase);
                            if (path && path.length > 1) {
                                const nextStep = path[1];
                                const w = this.getWallBetween(currentUnit.position.x, currentUnit.position.y, nextStep.x, nextStep.y);
                                if (w) {
                                    action = { type: 'wall_attack', target: nextStep, reason: 'Siege: Breaching' };
                                }
                            }
                        }
                    }
                }
            }

            // Step A: Survival Check
            if (!action && this.isUnitInDanger(currentUnit)) {
                const safeMove = this.findSafeMove(currentUnit, validMoves);
                if (safeMove) {
                    action = { type: 'move', target: safeMove, reason: 'Survival: Evade Threat' };
                }
            }
            // Step A1: T4 Backline Raid Prioritization
            if (!action && currentUnit.tier === 4) {
                const playerUnits = this.unitsSignal().filter(u => u.owner === 'player');
                if (playerUnits.length > 0) {
                    // Target weakest unit closest to Player Base (deep backline)
                    const pBase = this.getBasePosition('player');
                    const targetUnit = playerUnits
                        .map(u => ({ u, baseDist: Math.max(Math.abs(u.position.x - pBase.x), Math.abs(u.position.y - pBase.y)) }))
                        .sort((a, b) => {
                            if (a.u.tier !== b.u.tier) return a.u.tier - b.u.tier; // weakest first
                            return a.baseDist - b.baseDist; // closest to player base first
                        })[0].u;

                    const step = this.getNextStepTowards(currentUnit, targetUnit.position, validMoves);
                    if (step) {
                        action = { type: 'move', target: step, reason: 'T4 Raid: Flank Backline' };
                    }
                }
            }
            // Step B: Global Objective (Resource Capture / Siege Mode)
            if (!action) {
                // SIEGE MODE CHECK
                // Rule: If Wood > 100, 50% of mobile units switch to Siege Mode
                // Logic: ID-based deterministic selection for 50% split
                const siegeModeActive = this.aiWoodSignal() > 100;
                const isSiegeUnit = siegeModeActive && !this.isForest(currentUnit.position.x, currentUnit.position.y) && (parseInt(currentUnit.id.slice(-1), 16) % 2 === 0);

                if (isSiegeUnit) {
                    // Siege Mode Action: Move towards Player Base or Closest Player Unit
                    const playerUnits = this.unitsSignal().filter(u => u.owner === 'player');
                    let target = playerBase;

                    if (playerUnits.length > 0) {
                        // Find closest player unit
                        const closest = playerUnits.reduce((prev, curr) => {
                            const dPrev = Math.max(Math.abs(prev.position.x - currentUnit.position.x), Math.abs(prev.position.y - currentUnit.position.y));
                            const dCurr = Math.max(Math.abs(curr.position.x - currentUnit.position.x), Math.abs(curr.position.y - currentUnit.position.y));
                            return dCurr < dPrev ? curr : prev;
                        });
                        target = closest.position;
                    }

                    // Move or Attack towards target
                    const dist = Math.max(Math.abs(target.x - currentUnit.position.x), Math.abs(target.y - currentUnit.position.y));
                    if (dist <= 1) {
                        // Attack if adjacent (should be handled by Step C, but ensure here)
                        const combatTarget = this.findCombatTarget(currentUnit, turnContext, validMoves);
                        if (combatTarget) {
                            action = { type: 'attack', target: combatTarget, reason: 'Siege: Engage Enemy' };
                        }
                    } else {
                        const step = this.getNextStepTowards(currentUnit, target, validMoves);
                        if (step) {
                            action = { type: 'move', target: step, reason: 'Siege: Advance' };
                        } else {
                            // Try breaching if blocked
                            const path = this.bfsPath(currentUnit.position, target);
                            if (path && path.length > 1) {
                                const nextStep = path[1];
                                const wall = this.getWallBetween(currentUnit.position.x, currentUnit.position.y, nextStep.x, nextStep.y);
                                if (wall) {
                                    action = { type: 'wall_attack', target: nextStep, reason: 'Siege: Breaching' };
                                }
                            }
                        }
                    }
                }

                if (!action) {
                    const resourceTarget = this.findResourceTarget(currentUnit, turnContext);
                    if (resourceTarget) {
                        // Fortress Mode: Limit expansion range - DISABLED for dynamic targeting
                        // const dist = Math.abs(resourceTarget.x - currentUnit.position.x) + Math.abs(resourceTarget.y - currentUnit.position.y);
                        // if (!fortressMode || dist <= 8) {
                        // Adaptive Pathfinding: Try respecting walls first, then breaching
                        let path = this.bfsPath(currentUnit.position, resourceTarget, { respectWalls: true, avoidFriendlyUnits: true });

                        if (!path) {
                            path = this.bfsPath(currentUnit.position, resourceTarget, { avoidFriendlyUnits: true });
                        }

                        if (path && path.length > 1) {
                            const nextStep = path[1];

                            // Check for wall blockage
                            const wall = this.getWallBetween(currentUnit.position.x, currentUnit.position.y, nextStep.x, nextStep.y);
                            if (wall) {
                                // Self-Breach allowed (Adaptive Pathfinding), but protect base walls
                                if (wall.owner === 'ai' && this.isBaseProtectionEdge(currentUnit.position, nextStep)) {
                                    // Do not breach base protection
                                } else {
                                    action = { type: 'wall_attack', target: nextStep, reason: 'Objective: Breaching Wall' };
                                }
                            } else {
                                // Verify move validity (e.g., not blocked by unit)
                                if (validMoves.some(vm => vm.x === nextStep.x && vm.y === nextStep.y)) {
                                    action = { type: 'move', target: nextStep, reason: 'Objective: Capture Resource' };
                                }
                            }
                        }
                    }
                }
            }

            // Step C: Combat & Coordination
            if (!action) {
                const combatTarget = this.findCombatTarget(currentUnit, turnContext, validMoves);
                if (combatTarget) {
                    action = { type: 'attack', target: combatTarget, reason: 'Combat: Engage Enemy' };
                }
            }

            // Step E: Defensive Construction (Adjacent to Forest)
            if (!action && this.aiWoodSignal() >= 10) {
                // Check if adjacent to OUR forest
                const neighbors = this.getNeighbors(currentUnit.position);
                const nearOwnedForest = neighbors.some(n => this.isForest(n.x, n.y) && this.getUnitAt(n.x, n.y)?.owner === 'ai');
                if (nearOwnedForest) {
                    const wallTarget = this.findDefensiveWallTarget(currentUnit);
                    if (wallTarget) {
                        action = { type: 'build_wall', target: wallTarget, reason: 'Defense: Fortify Perimeter' };
                    }
                }
            }

            // Step D: Fallback (Prevent Freezing / Aggressive Advance)
            if (!action) {
                // Aggressive Pathfinding: Default to Player Base
                const fallbackTarget = playerBase;
                const fallback = this.findFallbackMove(currentUnit, validMoves, fallbackTarget);
                if (fallback) {
                    action = { type: 'move', target: fallback, reason: 'Fallback: Advance on Enemy' };
                }
            }

            // Execute
            if (action) {
                this.appendLog(`[AI Unit ${currentUnit.id.substring(0, 4)}] Action: ${action.reason} -> Target: (${action.target.x},${action.target.y})`);
                if (action.type === 'build_wall') {
                    this.aiBuildWallBetween(currentUnit.position, action.target);
                } else {
                    this.executeMove(currentUnit, action.target);
                }
                turnContext.claimedTargets.add(`${action.target.x},${action.target.y}`);
            } else {
                this.appendLog(`[AI Unit ${currentUnit.id.substring(0, 4)}] No valid moves. Passing.`);
                this.unitsSignal.update(units => units.map(u => u.id === currentUnit.id ? { ...u, hasActed: true } : u));
            }

            await new Promise(r => setTimeout(r, 60));
        }

        // console.log('>>> SWITCHING TO PLAYER SIDE NOW <<<');
        this.endTurn();
        // console.log('--- AI TURN FINISHED, WAITING FOR PLAYER ---');
        this.isAiThinking = false;
        this.aiBatchingActions = false;
        return;
    }

    // Helper for Phase 1: Executes ONE free action and returns true if something happened
    private executeOneFreeAction(): boolean {
        // 1. Critical Defense Spawning (Meat Shields)
        const aiBase = this.getBasePosition('ai');
        const threatsBase = this.unitsSignal().filter(u => u.owner === 'player' && Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3 && u.tier >= 2);

        if (threatsBase.length > 0) {
            // Find the biggest threat
            const highest = threatsBase.reduce((acc, e) => this.calculateTotalPoints(e) > this.calculateTotalPoints(acc) ? e : acc, threatsBase[0]);

            // If we have resources, try to spawn a blocker
            const reserves = this.reservePointsSignal().ai;
            if (reserves >= 1) { // Min cost for T1
                const didSpawn = this.aiDefenseSpawn(highest);
                if (didSpawn) return true;
            }
        }

        const aiUnitsCount = this.unitsSignal().filter(u => u.owner === 'ai').length;
        if (aiUnitsCount < 6) {
            const reservesNow = this.reservePointsSignal().ai;
            const t2Cost = this.getPointsForTierLevel(2, 1);
            if (reservesNow >= t2Cost) {
                const created = this.aiSpawnTier(2, 1, new Set<string>());
                if (created > 0) return true;
            }
        }

        // 2. Resource Management
        const baseHp = this.baseHealthSignal().ai;
        const reserveThreshold = baseHp < 50 ? 20 : 70;
        if (this.aiWoodSignal() >= reserveThreshold) {
            this.aiConvertWoodToReserve();
            return true;
        }

        // Emergency Spawn when reserves are high
        {
            const reservesNow = this.reservePointsSignal().ai;
            if (reservesNow >= 40) {
                const created = this.aiSpawnTier(2, 1, new Set<string>());
                if (created > 0) return true;
            }
        }

        // Overcoming unit limitations:
        // If AvailableReserve > 25 and ForestOwnership > 5, force building T3 (ignore type cap)
        {
            const reservesNow = this.reservePointsSignal().ai;
            const aiOwnedForests = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
            if (reservesNow > 25 && aiOwnedForests > 5) {
                const made = this.aiSpawnTier(3, 1, new Set<string>(), true);
                if (made > 0) return true;
            }
        }
        // 3. Expansion Spawning (Only if not threatened)
        if (threatsBase.length === 0) {
            // Logic from original code, but single step
            // T3 Hunter logic
            try {
                const t3Cost = this.getPointsForTierLevel(3, 1);
                const totalForests = this.forestsSignal().length;
                const aiControlCount = this.unitsSignal().filter(u => u.owner === 'ai' && this.isForest(u.position.x, u.position.y)).length;
                const aiControlPct = totalForests > 0 ? aiControlCount / totalForests : 0;
                const reservesNow = this.reservePointsSignal().ai;
                if (aiUnitsCount >= 6 && reservesNow >= t3Cost && aiControlPct <= 0.6) {
                    const count = this.aiSpawnTier(3, 1, new Set<string>());
                    if (count > 0) return true;
                }
            } catch { }
        }

        return false;
    }

    private aiDefenseSpawn(threat: Unit): boolean {
        const aiBase = this.getBasePosition('ai');
        // Compute path tiles between threat and base (blocking corridor)
        const path: Position[] = [];
        let cx = threat.position.x;
        let cy = threat.position.y;
        const stepX = Math.sign(aiBase.x - cx);
        const stepY = Math.sign(aiBase.y - cy);
        {
            let iter = 0;
            const maxIter = Math.max(10, this.gridSize * 2);
            while (cx !== aiBase.x || cy !== aiBase.y) {
                iter++;
                if (iter > maxIter) {
                    try { console.warn('[AI] Defense path safety break near base'); } catch { }
                    break;
                }
                cx += stepX;
                cy += stepY;
                if (!this.inBounds(cx, cy)) break;
                if (cx === aiBase.x && cy === aiBase.y) break;
                path.push({ x: cx, y: cy });
            }
        }
        // Pick the most critical empty tile: closest to base along the path
        const critical =
            path.reverse().find(p => !this.getUnitAt(p.x, p.y)) ||
            (() => {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const x = aiBase.x + dx;
                        const y = aiBase.y + dy;
                        if (!this.inBounds(x, y)) continue;
                        if (this.getUnitAt(x, y)) continue;
                        return { x, y };
                    }
                }
                return null;
            })();
        if (!critical) return false;

        // Auto-convert if desperate
        {
            let iter = 0;
            const maxIter = 50;
            while (this.aiWoodSignal() >= 20) {
                iter++;
                if (iter > maxIter) {
                    try { console.warn('[AI] Defense convert safety break'); } catch { }
                    break;
                }
                this.aiConvertWoodToReserve();
            }
        }

        const reserves = this.reservePointsSignal().ai;
        const cost = this.economy.getHighestAffordableCost(reserves);
        if (cost <= 0) return false;
        const tl = this.calculateTierAndLevel(cost);
        // Respect unit cap per type (excluding forest occupants)
        {
            const count = this.unitsSignal().filter(u => u.owner === 'ai' && u.tier === tl.tier && !this.isForest(u.position.x, u.position.y)).length;
            if (count >= 5) {
                return false;
            }
        }
        this.unitsSignal.update(units => [
            ...units,
            {
                id: crypto.randomUUID(),
                position: { ...critical },
                level: tl.level,
                tier: tl.tier,
                points: cost,
                owner: 'ai',
                turnsStationary: 0,
                forestOccupationTurns: 0,
                productionActive: false,
                hasActed: true
            }
        ]);
        this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai - cost }));
        this.recomputeVisibility();
        // console.log('[AI Defense] Spawned single strongest blocker at', critical, 'cost', cost);
        return true;
    }
    // --- Spawning ---

    private aiSpawnTier(tier: number, maxCount: number, blocked: Set<string>, overrideCap: boolean = false) {
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
        // Strict unit cap per type (excluding units currently occupying a forest)
        const countExclForests = (t: number) =>
            this.unitsSignal().filter(u => u.owner === 'ai' && u.tier === t && !this.isForest(u.position.x, u.position.y)).length;
        const typeCapReached = countExclForests(tier) >= 5;
        if (typeCapReached && !(overrideCap && tier === 3)) {
            return 0;
        }
        for (const pos of candidates) {
            if (created >= maxCount) break;
            // Reserve Rule: Spend available reserves (Wood is already reserved in conversion step)
            if (reserves < cost) break;
            if (countExclForests(tier) >= 5) break;
            const tl = this.calculateTierAndLevel(cost);
            placed.push({ id: crypto.randomUUID(), position: { ...pos }, level: tl.level, tier: tl.tier, points: cost, owner: 'ai', turnsStationary: 0, forestOccupationTurns: 0, productionActive: false, hasActed: true });
            reserves -= cost;
            created++;
        }
        if (placed.length > 0) {
            this.unitsSignal.update(units => [...units, ...placed]);
            this.reservePointsSignal.update(r => ({ player: r.player, ai: reserves }));
            this.recomputeVisibility();
            // console.log(`[AI Spawn] Created ${placed.length} unit(s) of T${tier}.`);
        }
        return created;
    }
    private aiConvertWoodToReserve() {
        const w = this.aiWoodSignal();
        const baseHp = this.baseHealthSignal().ai;
        // Reserve Rule: Keep 50 wood untouchable (UNLESS Emergency: Base HP < 50%)
        const threshold = baseHp < 50 ? 20 : 70;
        if (w < threshold) return;
        this.aiWoodSignal.update(x => x - 20);
        this.reservePointsSignal.update(r => ({ player: r.player, ai: r.ai + 1 }));
    }
    spawnUnit(owner: Owner) {
        const basePosition: Position = this.getBasePosition(owner);
        this.unitsSignal.update(units => {
            const occupied = units.some(u => u.position.x === basePosition.x && u.position.y === basePosition.y);
            if (occupied) return units;
            const newUnit: Unit = { id: crypto.randomUUID(), position: { ...basePosition }, level: 1, tier: 1, points: 1, owner, turnsStationary: 0, forestOccupationTurns: 0, productionActive: false, hasActed: true };
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
        const diff: Difficulty = this.settings.difficulty();
        let unitsToCreate;
        if (diff === 'baby') {
            unitsToCreate = [
                { tier: 4, level: 1 },
                { tier: 3, level: 1 },
                { tier: 2, level: 1 },
                { tier: 1, level: 1 }
            ];
        } else {
            unitsToCreate = [
                { tier: 1, level: 1 },
                { tier: 1, level: 1 },
            ];
        }
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
                turnsStationary: 0,
                hasActed: true
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
    clearLogs() {
        return this.log.clear();
    }
    private appendLog(entry: string, color?: 'text-green-400' | 'text-red-400' | 'text-yellow-300' | 'text-gray-200') {
        this.log.add(entry, color);
    }

    buildWallBetween(tile1: Position, tile2: Position) {
        const wood = this.resourcesSignal().wood;
        if (wood < 10) return;
        if (!this.canBuildWallBetween(tile1, tile2)) return;
        const actor = this.getBestAdjacentPlayerUnit(tile1, tile2);
        if (!actor || actor.hasActed) return;
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
        this.updateWallFormations();
        this.resourcesSignal.update(r => ({ wood: r.wood - 10 }));
        this.buildModeSignal.set(false);
        this.wallBuiltThisTurnSignal.set(true);
        this.unitsSignal.update(units =>
            units.map(u => (u.id === actor.id ? { ...u, hasActed: true } : u))
        );
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
    startSandboxSpawn(owner: Owner, tier: number) {
        if (!this.settings.customMode()) return;
        this.sandboxSpawnPendingSignal.set({ owner, tier });
    }
    cancelSandboxSpawn() {
        this.sandboxSpawnPendingSignal.set(null);
    }
    spawnSandboxAt(target: Position) {
        const pending = this.sandboxSpawnPendingSignal();
        if (!pending) return;
        if (!this.settings.customMode()) return;
        if (this.getUnitAt(target.x, target.y)) return;
        const points = this.getPointsForTierLevel(pending.tier, 1);
        const newUnit: Unit = {
            id: crypto.randomUUID(),
            position: { ...target },
            level: 1,
            tier: pending.tier,
            points,
            owner: pending.owner,
            turnsStationary: 0,
            forestOccupationTurns: 0,
            productionActive: false,
            hasActed: true
        };
        this.unitsSignal.update(units => [...units, newUnit]);
        this.sandboxSpawnPendingSignal.set(null);
        this.recomputeVisibility();
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
            this.unitsSignal.update(units => [...units, { id: crypto.randomUUID(), position: { ...pos }, level: tl.level, tier: tl.tier, points: cost, owner: 'player', turnsStationary: 0, forestOccupationTurns: 0, productionActive: false, hasActed: true }]);
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
            const newUnit: Unit = { id: crypto.randomUUID(), position: { ...target }, level: tl.level, tier: tl.tier, points: cost, owner: 'player', turnsStationary: 0, hasActed: true };
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
    private edgeKey(a: Position, b: Position): string {
        const [s1, s2] = this.sortEdgeEndpoints(a, b);
        return `${s1.x},${s1.y}|${s2.x},${s2.y}`;
    }
    private registerWallDestroyedEdge(a: Position, b: Position) {
        const key = this.edgeKey(a, b);
        const map = new Map(this.wallCooldownSignal());
        map.set(key, this.turnSignal());
        this.wallCooldownSignal.set(map);
    }
    isEdgeOnCooldown(tile1: Position, tile2: Position): boolean {
        const key = this.edgeKey(tile1, tile2);
        const last = this.wallCooldownSignal().get(key);
        if (last === undefined) return false;
        const remaining = 5 - (this.turnSignal() - last);
        return remaining > 0;
    }
    edgeCooldownRemaining(tile1: Position, tile2: Position): number {
        const key = this.edgeKey(tile1, tile2);
        const last = this.wallCooldownSignal().get(key);
        if (last === undefined) return 0;
        const remaining = 5 - (this.turnSignal() - last);
        return Math.max(0, remaining);
    }

    attackOrDestroyWallBetween(tile1: Position, tile2: Position, consumeTurn: boolean = false) {
        const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
        if (!wall) return;

        const actor: Owner = this.activeSideSignal();
        if (actor === 'ai' && this.isBaseProtectionEdge(tile1, tile2)) {
            if (wall.owner === 'neutral') {
                this.appendLog(`[Turn ${this.turnSignal()}] [AI Base Protection] Blocked destruction of neutral wall adjacent to base.`);
                try { console.warn('[AI] Blocked neutral wall destruction adjacent to base'); } catch { }
                return;
            }
            if (wall.owner === 'ai') {
                this.appendLog(`[Turn ${this.turnSignal()}] [AI Base Protection] Blocked destruction of own wall adjacent to base.`);
                try { console.warn('[AI] Blocked own wall destruction adjacent to base'); } catch { }
                return;
            }
        }
        if (wall.owner === 'player' && actor === 'player') {
            this.destroyOwnWallBetween(tile1, tile2);
            return;
        }
        const unit =
            actor === 'player'
                ? this.getBestAdjacentPlayerUnit(tile1, tile2)
                : this.getBestAdjacentAiUnit(tile1, tile2);
        if (!unit) return;
        if (actor === 'player' && unit.hasActed) return;

        // Attack lunge ping-pong for wall attacks
        {
            const dxTotal = tile2.x - tile1.x;
            const dyTotal = tile2.y - tile1.y;
            const useX = Math.abs(dxTotal) >= Math.abs(dyTotal);
            const step = useX ? Math.sign(dxTotal) : Math.sign(dyTotal);
            const gap = this.wallThicknessPx + 2;
            const cell = this.tileSizePx + gap;
            const amp = Math.round(cell * 0.35);
            const dx = useX ? step * amp : 0;
            const dy = useX ? 0 : step * amp;
            const s = new Set(this.attackingUnitsSignal());
            s.add(unit.id);
            this.attackingUnitsSignal.set(s);
            this.attackerNudgeSignal.set({ id: unit.id, dx, dy });
            setTimeout(() => {
                this.attackerNudgeSignal.set({ id: unit.id, dx: 0, dy: 0 });
            }, 100);
            setTimeout(() => {
                this.attackerNudgeSignal.set(null);
                const s2 = new Set(this.attackingUnitsSignal());
                s2.delete(unit.id);
                this.attackingUnitsSignal.set(s2);
            }, 200);
        }

        const damageAbs = this.combat.getWallHitAmount(unit.tier);
        const [a, b] = this.sortEdgeEndpoints(tile1, tile2);
        const maxH = wall.maxHealth ?? 100;
        const nextHealth = Math.max(0, wall.health - damageAbs);
        this.wallsSignal.update(ws =>
            ws
                .map(w =>
                    w.id === wall.id
                        ? { ...w, health: Math.max(0, w.health - damageAbs) }
                        : w
                )
                .filter(w => w.health > 0)
        );
        if (nextHealth <= 0) {
            this.registerWallDestroyedEdge(a, b);
            this.updateWallFormations();
        } else {
            this.updateWallFormations();
        }
        this.shakenWallIdSignal.set(wall.id);
        setTimeout(() => this.shakenWallIdSignal.set(null), 200);
        const actorText = actor === 'player' ? 'Player' : 'AI';
        const targetOwnerText = wall.owner === 'neutral' ? 'Neutral' : (wall.owner === 'player' ? 'Player' : 'AI');
        this.appendLog(`[Combat] Tier ${unit.tier} Unit attacked ${targetOwnerText} Wall. Damage: ${damageAbs}. Wall HP: ${nextHealth}/${maxH}.`);
        if (actor === 'ai') {
            this.appendLog(`[AI Pathfinding] Breaking through wall at (${tile2.x},${tile2.y}) to reach target.`);
        }
        // Mark the acting unit as having acted
        this.unitsSignal.update(units => units.map(u => (u.id === unit.id ? { ...u, hasActed: true } : u)));

        if (actor === 'player') {
            this.selectNextAvailableUnit();
        }
    }

    destroyOwnWallBetween(tile1: Position, tile2: Position) {
        const wall = this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y);
        if (!wall) return;
        if (wall.owner !== 'player') return;
        if (!this.isAnyPlayerUnitAdjacentToEdge(tile1, tile2)) return;
        this.wallsSignal.update(ws => ws.filter(w => w.id !== wall.id));
        const [a, b] = this.sortEdgeEndpoints(tile1, tile2);
        this.registerWallDestroyedEdge(a, b);
        this.appendLog(`[Turn ${this.turnSignal()}] Player removed own wall between (${tile1.x},${tile1.y})-(${tile2.x},${tile2.y}).`);
        this.updateWallFormations();
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
        if (wall.owner === 'player') return false;
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

    canAddReserveTurn(): boolean {
        return this.resourcesSignal().wood >= 20;
    }

    isPlayerTurn(): boolean {
        if (this.gameStatusSignal() !== 'playing') return false;
        return this.activeSideSignal() === 'player';
    }
    remainingActions(): number {
        return this.unitsSignal().filter(u => u.owner === 'player' && !u.hasActed).length;
    }
    totalPlayerUnits(): number {
        return this.unitsSignal().filter(u => u.owner === 'player').length;
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
                !u.hasActed &&
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
    private getAdjacentAiUnits(tile1: Position, tile2: Position): Unit[] {
        return this.unitsSignal().filter(
            u =>
                u.owner === 'ai' &&
                !u.hasActed &&
                ((u.position.x === tile1.x && u.position.y === tile1.y) ||
                    (u.position.x === tile2.x && u.position.y === tile2.y))
        );
    }
    private getBestAdjacentAiUnit(tile1: Position, tile2: Position): Unit | null {
        const candidates = this.getAdjacentAiUnits(tile1, tile2);
        if (candidates.length === 0) return null;
        return candidates.reduce((best, u) =>
            this.calculateTotalPoints(u) > this.calculateTotalPoints(best) ? u : best
        );
    }

    canShowBuildIcon(tile1: Position, tile2: Position): boolean {
        if (!this.buildModeSignal()) return false;
        if (!this.canBuildThisTurn()) return false;
        if (!this.canBuildWallBetween(tile1, tile2)) return false;
        return !!this.getBestAdjacentPlayerUnit(tile1, tile2);
    }

    isInSafeZone(x: number, y: number): boolean {
        return this.isInNoBuildZone({ x, y });
    }

    canBuildWallBetween(tile1: Position, tile2: Position): boolean {
        if (!this.areAdjacent(tile1, tile2)) return false;
        if (!this.isVisibleToPlayer(tile1.x, tile1.y) && !this.isVisibleToPlayer(tile2.x, tile2.y)) return false;
        if (this.isInNoBuildZone(tile1) || this.isInNoBuildZone(tile2)) return false;
        if (!!this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y)) return false;
        if (this.isEdgeOnCooldown(tile1, tile2)) return false;
        return true;
    }

    private aiBuildWallBetween(tile1: Position, tile2: Position) {
        if (this.wallBuiltThisTurnSignal()) return;
        if (this.aiWoodSignal() < 50) return;

        // Get the AI actor (builder)
        const actor = this.getBestAdjacentAiUnit(tile1, tile2);
        if (!actor || actor.hasActed) return;

        // Threat Proximity Check (Strategic Construction)
        // Rule: Only build if enemy is within 2 tiles (striking distance) AND enemy is stronger/equal
        const enemies = this.unitsSignal().filter(u => u.owner === 'player');
        const isThreatNearby = enemies.some(e => {
            const d1 = Math.max(Math.abs(e.position.x - tile1.x), Math.abs(e.position.y - tile1.y));
            const d2 = Math.max(Math.abs(e.position.x - tile2.x), Math.abs(e.position.y - tile2.y));
            // Check striking distance (<=2) and Tier condition (Enemy >= AI)
            if (d1 <= 2 || d2 <= 2) {
                return e.tier >= actor.tier;
            }
            return false;
        });

        if (!isThreatNearby) return;
        if (!this.areAdjacent(tile1, tile2)) return;
        if (this.isInNoBuildZone(tile1) || this.isInNoBuildZone(tile2)) return;
        if (this.getWallBetween(tile1.x, tile1.y, tile2.x, tile2.y)) return;
        if (this.isEdgeOnCooldown(tile1, tile2)) return;
        if (this.wouldCageElite(tile1, tile2) && !this.isBaseProtectionEdge(tile1, tile2)) return;

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
        this.unitsSignal.update(units =>
            units.map(u => (u.id === actor.id ? { ...u, hasActed: true } : u))
        );
        this.updateWallFormations();
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
    private tryDefensiveWallsNearForests(): boolean {
        if (this.wallBuiltThisTurnSignal()) return false;
        const aiUnits = this.unitsSignal().filter(u => u.owner === 'ai');
        const playerUnits = this.unitsSignal().filter(u => u.owner === 'player');
        const aiBase = this.getBasePosition('ai');
        for (const u of aiUnits) {
            if (!this.isForest(u.position.x, u.position.y)) continue;
            const enemies = playerUnits.filter(p => {
                const cheb = Math.max(Math.abs(p.position.x - u.position.x), Math.abs(p.position.y - u.position.y));
                return cheb <= 2;
            });
            for (const e of enemies) {
                const myLevel = u.level ?? this.calculateTierAndLevel(u.points).level;
                const enemyLevel = e.level ?? this.calculateTierAndLevel(e.points).level;
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
                if (enemyLevel >= myLevel && this.aiWoodSignal() >= 20) {
                    this.aiBuildWallBetween(a, b);
                    this.appendLog(`[Turn ${this.turnSignal()}] [AI Stealth] Defensive wall triggered against Player threat. Edge: (${a.x},${a.y})-(${b.x},${b.y}).`);
                }
                if (this.wallBuiltThisTurnSignal()) {
                    return true;
                }
            }
        }
        return false;
    }
    private isInNoBuildZone(tile: Position): boolean {
        return this.build.isInNoBuildZone(tile, this.getBasePosition('player'), this.getBasePosition('ai'));
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

    private placeNeutralWalls() {
        const addNeutral = (a: Position, b: Position) => {
            if (!this.areAdjacent(a, b)) return;
            if (!this.inBounds(a.x, a.y) || !this.inBounds(b.x, b.y)) return;
            if (this.getWallBetween(a.x, a.y, b.x, b.y)) return;
            const [p, q] = this.sortEdgeEndpoints(a, b);
            this.wallsSignal.update(ws => [
                ...ws,
                {
                    id: crypto.randomUUID(),
                    tile1: { x: p.x, y: p.y },
                    tile2: { x: q.x, y: q.y },
                    health: 100,
                    owner: 'neutral'
                }
            ]);
            this.updateWallFormations();
        };
        const bases = [this.getBasePosition('player'), this.getBasePosition('ai')];
        for (const base of bases) {
            const neighbors: Position[] = [
                { x: base.x + 1, y: base.y },
                { x: base.x - 1, y: base.y },
                { x: base.x, y: base.y + 1 },
                { x: base.x, y: base.y - 1 }
            ];
            for (const n of neighbors) {
                if (this.inBounds(n.x, n.y)) addNeutral(base, n);
            }
        }
        for (const f of this.forestsSignal()) {
            const east = { x: f.x + 1, y: f.y };
            const south = { x: f.x, y: f.y + 1 };
            const west = { x: f.x - 1, y: f.y };
            const north = { x: f.x, y: f.y - 1 };
            if (this.inBounds(east.x, east.y)) addNeutral(f, east);
            if (this.inBounds(south.x, south.y)) addNeutral(f, south);
            if (this.inBounds(west.x, west.y)) addNeutral(f, west);
            if (this.inBounds(north.x, north.y)) addNeutral(f, north);
        }
    }
}
