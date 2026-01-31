import { Injectable } from '@angular/core';
import { Position, Unit } from '../models/unit.model';
import { CombatService } from './combat.service';
import { SettingsService } from './settings.service';

@Injectable({ providedIn: 'root' })
export class AiStrategyService {
    constructor(private combat: CombatService, private settings: SettingsService) { }
    private goals = new Map<string, Position>();
    private lastPhase: 'expansion' | 'defense' | 'full_rush' | 'none' = 'none';
    private interceptUntil = new Map<string, number>();
    setGoal(unitId: string, pos: Position) {
        this.goals.set(unitId, pos);
    }

    pickBestMove(engine: any): { unit: Unit; target: Position; reason: string } | null {
        const d = this.chooseBestEndingAction(engine);
        if (!d) return null;
        if (d.type === 'move' || d.type === 'attack') return { unit: d.unit, target: d.target, reason: d.reason };
        return null;
    }

    chooseBestEndingAction(engine: any): { type: 'move' | 'attack' | 'merge' | 'wall_attack'; unit: Unit; target: Position; reason: string; edge?: { from: Position; to: Position } } | null {
        // CRITICAL LOGIC: Pathfinding + Wall Breaker decisions drive AI aggression and anti-paralysis.
        // Do not remove or weaken these branches; they ensure hunters breach walls and forests remain contestable.
        const alreadyMoved: Set<string> = new Set(engine.movedThisTurnSignal?.() ?? []);
        let aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && !alreadyMoved.has(u.id));
        aiUnits = aiUnits.filter((u: Unit) => !(u.tier <= 2 && engine.isForest(u.position.x, u.position.y) && engine.isAnchoredGatherer(u.id)));
        const queued = typeof engine.queuedUnitId === 'function' ? engine.queuedUnitId() : null;
        if (queued) {
            aiUnits = aiUnits.filter((u: Unit) => u.id === queued);
        }
        const mood = typeof engine.currentMood === 'function' ? engine.currentMood() : 'none';
        const aggressiveBonus: number = this.settings.difficulty() === 'baby' ? -10000 : mood === 'rage' ? 50000 : (mood === 'angry' ? 10000 : 0);
        if (aiUnits.length === 0) return null;
        const aiBase: Position = engine.getBasePosition('ai');
        const playerBase: Position = engine.getBasePosition('player');
        const forests: Position[] = engine.forestsSignal();
        const unoccupied = forests.filter(f => !engine.getUnitAt(f.x, f.y));
        const visibleFree = unoccupied.filter(f => engine.isVisibleToAi(f.x, f.y));
        const fogForests = forests.filter(f => !engine.isVisibleToAi(f.x, f.y));
        const aiForestCount = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && engine.isForest(u.position.x, u.position.y)).length;
        const aiTotalUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai').length;
        const capReachedAny = [1, 2, 3].some(t =>
            engine.unitsSignal().filter((u: Unit) => u.owner === 'ai' && u.tier === t && !engine.isForest(u.position.x, u.position.y)).length >= 5
        );
        const playerUnits: Unit[] = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
        const enemyNearBase = playerUnits.some((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3);
        const baseThreatEnemies = playerUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 4);
        const baseThreat = baseThreatEnemies.length > 0;
        const immediateThreatEnemies = baseThreatEnemies.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 2);
        const immediateThreat = immediateThreatEnemies.length > 0;
        const baseProximity = playerUnits.some((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 5);
        const isEarlyGame = typeof engine.turnSignal === 'function' ? engine.turnSignal() <= 40 : false;
        // Full Rush Logic
        const allAiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai');
        const t3NonForest = allAiUnits.filter((u: Unit) => u.tier === 3 && !engine.isForest(u.position.x, u.position.y)).length;
        const t4NonForest = allAiUnits.filter((u: Unit) => u.tier === 4 && !engine.isForest(u.position.x, u.position.y)).length;
        // "TotalUnits(non-forest) >= (5 Squares T3) and T4" -> We interpret as T3 >= 5 or (T3 + T4) >= 5, ignoring lower tiers
        const fullRushActive = (t3NonForest + t4NonForest) >= 5;

        const phase: 'expansion' | 'defense' | 'full_rush' | 'none' = fullRushActive ? 'full_rush' : (baseThreat ? 'defense' : (isEarlyGame ? 'expansion' : 'none'));
        if (phase !== this.lastPhase) {
            try { 
                if (phase === 'full_rush') console.log('AI Phase: FULL RUSH ACTIVATED - Initiating All-Out Assault');
                else console.log(phase === 'defense' ? 'AI Phase: Base Defense Activated' : (phase === 'expansion' ? 'AI Phase: Expansion' : 'AI Phase: Normal')); 
            } catch {}
            this.lastPhase = phase;
        }

        if (fullRushActive) {
              // Wave Motion: Sort units by distance to player base so closest act first
              aiUnits.sort((a: Unit, b: Unit) => {
                  const da = Math.abs(a.position.x - playerBase.x) + Math.abs(a.position.y - playerBase.y);
                  const db = Math.abs(b.position.x - playerBase.x) + Math.abs(b.position.y - playerBase.y);
                  return da - db;
              });
         }

        const aggression = typeof engine.aggressionMode === 'function' ? !!engine.aggressionMode() : (playerUnits.filter((p: Unit) => engine.isForest(p.position.x, p.position.y)).length * 2) >= (aiUnits.filter((a: Unit) => engine.isForest(a.position.x, a.position.y)).length * 2);
        const forestsSecured = forests.length > 0 ? forests.every(f => {
            const u = engine.getUnitAt(f.x, f.y);
            return !!u && u.owner === 'ai';
        }) : true;
        const forestsAllOccupied = forests.length > 0 ? forests.every(f => !!engine.getUnitAt(f.x, f.y)) : false;
        const playerOwnedForests = forests.filter(f => {
            const u = engine.getUnitAt(f.x, f.y);
            return !!u && u.owner === 'player';
        });
        let best: { unit: Unit; target: Position; score: number; type: 'move' | 'attack' | 'merge' | 'wall_attack'; reason: string; edge?: { from: Position; to: Position } } | null = null;
        const clusterCount = aiUnits.filter((u: Unit) => Math.max(Math.abs(u.position.x - aiBase.x), Math.abs(u.position.y - aiBase.y)) <= 3).length;
        const center = { x: Math.floor(engine.gridSize / 2), y: Math.floor(engine.gridSize / 2) };
        const primaryThreat = baseThreatEnemies.length > 0 ? baseThreatEnemies.reduce((acc, e) => {
            const d = Math.max(Math.abs(e.position.x - aiBase.x), Math.abs(e.position.y - aiBase.y));
            const da = Math.max(Math.abs(acc.position.x - aiBase.x), Math.abs(acc.position.y - aiBase.y));
            return d < da ? e : acc;
        }, baseThreatEnemies[0]) : null;
        const strongestAi = aiUnits.length > 0 ? aiUnits.reduce((acc: Unit, u: Unit) => (this.combat.calculateTotalPoints(u) > this.combat.calculateTotalPoints(acc) ? u : acc), aiUnits[0]) : null;
        const blockingTiles: Position[] = [];
        if (primaryThreat) {
            let cx = primaryThreat.position.x;
            let cy = primaryThreat.position.y;
            const stepX = Math.sign(aiBase.x - cx);
            const stepY = Math.sign(aiBase.y - cy);
            let iter = 0;
            const maxIter = Math.max(10, engine.gridSize * 2);
            while (cx !== aiBase.x || cy !== aiBase.y) {
                iter++;
                if (iter > maxIter) {
                    try { console.warn('[AI] Path build safety break near base'); } catch {}
                    break;
                }
                cx += stepX;
                cy += stepY;
                if (!engine.inBounds(cx, cy)) break;
                if (cx === aiBase.x && cy === aiBase.y) break;
                blockingTiles.push({ x: cx, y: cy });
            }
        }
        if (baseThreat && strongestAi && primaryThreat) {
            this.goals.set(strongestAi.id, { x: primaryThreat.position.x, y: primaryThreat.position.y });
            if (typeof engine.turnSignal === 'function') {
                this.interceptUntil.set(strongestAi.id, engine.turnSignal() + 3);
            }
        }
        const timeMap: Map<string, number> = new Map(engine.aiUnitTimeNearBase());
        const stutterBan: Map<string, { tiles: Set<string>; until: number }> = new Map(engine.unitStutterBanSignal?.() ?? new Map());
        const goalCounts: Map<string, number> = new Map();
        for (const [uid, pos] of this.goals.entries()) {
            if (pos && engine.isForest(pos.x, pos.y)) {
                const key = `${pos.x},${pos.y}`;
                goalCounts.set(key, (goalCounts.get(key) || 0) + 1);
            }
        }
        for (const unit of aiUnits) {
            const moves: Position[] = engine.calculateValidMoves(unit);
            const nearBase = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y)) <= 3;
            const stagnantTurns = (timeMap.get(unit.id) || 0);
            let goal: Position | null = this.goals.get(unit.id) || null;
            const hasGoal = goal !== null;
            const goalOccupiedByStrongerAlly = hasGoal ? (() => {
                const gUnit = engine.getUnitAt(goal!.x, goal!.y);
                return !!(gUnit && gUnit.owner === 'ai' && this.combat.calculateTotalPoints(gUnit) >= this.combat.calculateTotalPoints(unit));
            })() : false;
            const needNewGoal = (!hasGoal || goalOccupiedByStrongerAlly) && (!engine.isForest(unit.position.x, unit.position.y) || baseProximity || unit.tier >= 3);
            const totalWar = typeof engine.totalWarMode === 'function' ? engine.totalWarMode() : false;
            if (needNewGoal) {
                if (totalWar) {
                    goal = { x: playerBase.x, y: playerBase.y };
                } else if (!engine.isForest(unit.position.x, unit.position.y)) {
                    const playerForests = playerUnits.filter(p => engine.isForest(p.position.x, p.position.y)).map(p => ({ x: p.position.x, y: p.position.y }));
                    if (playerForests.length > 0) {
                        const nearestPF = playerForests.reduce((acc, f) => {
                            const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                            const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
                            return d < da ? f : acc;
                        }, playerForests[0]);
                        goal = nearestPF;
                    } else if (visibleFree.length > 0) {
                        const minAssigned = Math.min(...visibleFree.map(f => goalCounts.get(`${f.x},${f.y}`) || 0));
                        const fair = visibleFree.filter(f => (goalCounts.get(`${f.x},${f.y}`) || 0) === minAssigned);
                        goal = fair.reduce((acc, f) => {
                            const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                            return d < (Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y)) ? f : acc;
                        }, fair[0]);
                    } else if (fogForests.length > 0) {
                        const minAssignedFog = Math.min(...fogForests.map(f => goalCounts.get(`${f.x},${f.y}`) || 0));
                        const fairFog = fogForests.filter(f => (goalCounts.get(`${f.x},${f.y}`) || 0) === minAssignedFog);
                        goal = fairFog.reduce((acc, f) => {
                            const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                            return d < (Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y)) ? f : acc;
                        }, fairFog[0]);
                    } else {
                        const nearestEnemy = (() => {
                            if (playerUnits.length === 0) return null;
                            const sorted = [...playerUnits].sort((a, b) => {
                                const da = Math.abs(unit.position.x - a.position.x) + Math.abs(unit.position.y - a.position.y);
                                const db = Math.abs(unit.position.x - b.position.x) + Math.abs(unit.position.y - b.position.y);
                                return da - db;
                            });
                            return sorted[0];
                        })();
                        goal = nearestEnemy ? { x: nearestEnemy.position.x, y: nearestEnemy.position.y } : { x: 0, y: 0 };
                    }
                } else {
                    const enemyOnForest = playerUnits.filter(p => engine.isForest(p.position.x, p.position.y));
                    if (aggression && enemyOnForest.length > 0) {
                        const nearestEF = enemyOnForest.reduce((acc, e) => {
                            const d = Math.abs(unit.position.x - e.position.x) + Math.abs(unit.position.y - e.position.y);
                            const da = Math.abs(unit.position.x - acc.position.x) + Math.abs(unit.position.y - acc.position.y);
                            return d < da ? e : acc;
                        }, enemyOnForest[0]);
                        goal = { x: nearestEF.position.x, y: nearestEF.position.y };
                    } else {
                        const nearestEnemy = (() => {
                            if (playerUnits.length === 0) return null;
                            const sorted = [...playerUnits].sort((a, b) => {
                                const da = Math.abs(unit.position.x - a.position.x) + Math.abs(unit.position.y - a.position.y);
                                const db = Math.abs(unit.position.x - b.position.x) + Math.abs(unit.position.y - b.position.y);
                                return da - db;
                            });
                            return sorted[0];
                        })();
                        if (nearestEnemy) {
                            goal = { x: nearestEnemy.position.x, y: nearestEnemy.position.y };
                        } else if (visibleFree.length > 0) {
                            goal = visibleFree.reduce((acc, f) => {
                                const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                                return d < (Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y)) ? f : acc;
                            }, visibleFree[0]);
                        } else if (fogForests.length > 0) {
                            goal = fogForests.reduce((acc, f) => {
                                const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                                return d < (Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y)) ? f : acc;
                            }, fogForests[0]);
                        } else {
                            goal = { x: 0, y: 0 };
                        }
                    }
                }
                this.goals.set(unit.id, goal!);
            }
            const forceCenter = clusterCount > 3 && stagnantTurns >= 5;
            if (forceCenter) {
                goal = center;
            }
            const isOnForest = engine.isForest(unit.position.x, unit.position.y);
            const inSession = isOnForest && (unit.forestOccupationTurns ?? 0) > 0 && !(unit.productionActive ?? false);
            const lowTierNearby = engine.unitsSignal().some((u2: Unit) =>
                u2.owner === 'ai' && u2.id !== unit.id && u2.tier <= 2 &&
                Math.max(Math.abs(u2.position.x - unit.position.x), Math.abs(u2.position.y - unit.position.y)) <= 2
            );
            if (inSession && !baseProximity && unit.tier < 3) {
                this.goals.set(unit.id, { x: unit.position.x, y: unit.position.y });
                // console.log(`[AI Block] Unit ${unit.id} is blocked in the forest at (${unit.position.x},${unit.position.y}). Progress: ${(unit.forestOccupationTurns ?? 0)}/3.`);
                continue;
            }
            if (unit.tier >= 3) {
                const allForests = forests;
                const nearestForest = allForests.length
                    ? allForests.reduce((acc, f) => {
                        const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                        const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
                        return d < da ? f : acc;
                    }, allForests[0])
                    : null;
                const fresh = (unit.forestOccupationTurns ?? 0) === 0 && !isOnForest;
                if (fresh && nearestForest) {
                    goal = { x: nearestForest.x, y: nearestForest.y };
                    this.goals.set(unit.id, goal);
                }
                if (isOnForest && lowTierNearby) {
                    this.goals.set(unit.id, { x: playerBase.x, y: playerBase.y });
                    const neighbors: Position[] = [
                        { x: unit.position.x + 1, y: unit.position.y },
                        { x: unit.position.x - 1, y: unit.position.y },
                        { x: unit.position.x, y: unit.position.y + 1 },
                        { x: unit.position.x, y: unit.position.y - 1 }
                    ].filter(p => engine.inBounds(p.x, p.y));
                    const blockedNeighbors = neighbors.filter(n => !!engine.getWallBetween(unit.position.x, unit.position.y, n.x, n.y));
                    if (blockedNeighbors.length === neighbors.length) {
                        const towardBase = neighbors.reduce((acc, n) => {
                            const db = Math.abs(n.x - playerBase.x) + Math.abs(n.y - playerBase.y);
                            const da = Math.abs(acc.x - playerBase.x) + Math.abs(acc.y - playerBase.y);
                            return db < da ? n : acc;
                        });
                        best = { unit, target: { x: unit.position.x, y: unit.position.y }, score: 2200000, type: 'wall_attack', reason: 'Siege: Breakthrough (Handover)', edge: { from: { ...unit.position }, to: towardBase } };
                        continue;
                    }
                }
            }
            const canAttackBaseNow = moves.some(m => m.x === playerBase.x && m.y === playerBase.y);
            if (canAttackBaseNow) {
                const siegeBonus = ((unit.tier === 3 && unit.level >= 2) || unit.tier >= 4) ? 300000 : 0;
                const score = 50000000 + aggressiveBonus + siegeBonus; // WIN GAME PRIORITY
                const reason = 'Siege: Attack Base (WIN)';
                if (best === null || score > best.score) {
                    best = { unit, target: { x: playerBase.x, y: playerBase.y }, score, type: 'attack', reason };
                }
            } else {
                const baseNeighbors: Position[] = [
                    { x: playerBase.x + 1, y: playerBase.y },
                    { x: playerBase.x - 1, y: playerBase.y },
                    { x: playerBase.x, y: playerBase.y + 1 },
                    { x: playerBase.x, y: playerBase.y - 1 }
                ].filter(p => engine.inBounds(p.x, p.y));
                for (const nb of baseNeighbors) {
                    const wBase = engine.getWallBetween(playerBase.x, playerBase.y, nb.x, nb.y);
                    if (wBase && wBase.owner === 'neutral') {
                        const onEndpoint = (unit.position.x === nb.x && unit.position.y === nb.y) || (unit.position.x === playerBase.x && unit.position.y === playerBase.y);
                        if (onEndpoint) {
                            const siegeBonus = ((unit.tier === 3 && unit.level >= 2) || unit.tier >= 4) ? 300000 : 0;
                            const score = 2000000 + aggressiveBonus + siegeBonus;
                            const reason = 'Siege: Destroy Base Wall';
                            if (best === null || score > best.score) {
                                best = { unit, target: { ...unit.position }, score, type: 'wall_attack', reason, edge: { from: { x: playerBase.x, y: playerBase.y }, to: { x: nb.x, y: nb.y } } };
                            }
                        } else {
                            const canStepToEndpoint = moves.some(m => (m.x === nb.x && m.y === nb.y) || (m.x === playerBase.x && m.y === playerBase.y));
                            if (canStepToEndpoint) {
                                const endpoint = moves.find(m => (m.x === nb.x && m.y === nb.y) || (m.x === playerBase.x && m.y === playerBase.y))!;
                                const siegeBonus = ((unit.tier === 3 && unit.level >= 2) || unit.tier >= 4) ? 300000 : 0;
                                const score = 1800000 + aggressiveBonus + siegeBonus;
                                const reason = 'Siege: Position at Base Wall';
                                if (best === null || score > best.score) {
                                    best = { unit, target: { x: endpoint.x, y: endpoint.y }, score, type: 'move', reason };
                                }
                            }
                        }
                    }
                }
            }
            if (goal) {
                const enemyAtGoal = engine.getUnitAt(goal.x, goal.y);
                if (enemyAtGoal && enemyAtGoal.owner === 'player' && engine.isForest(goal.x, goal.y)) {
                    const gx = goal.x;
                    const gy = goal.y;
                    const canAttack = moves.some(m => m.x === gx && m.y === gy);
                    if (canAttack) {
                        const score = 300000;
                        const reason = 'Attack Enemy on Forest';
                        if (best === null || score > best.score) {
                            best = { unit, target: { x: gx, y: gy }, score, type: 'attack', reason };
                        }
                        continue;
                    } else {
                        const candidates = visibleFree.length > 0 ? visibleFree : fogForests;
                        if (candidates.length > 0) {
                            const nearest = candidates.reduce((acc, f) => {
                                const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                                const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
                                return d < da ? f : acc;
                            }, candidates[0]);
                            goal = nearest;
                            this.goals.set(unit.id, goal);
                        } else {
                            continue;
                        }
                    }
                }
            }
            let breachTarget: Position | null = null;
            if (goal && engine.isForest(goal.x, goal.y) && !engine.getUnitAt(goal.x, goal.y)) {
                const neighbors: Position[] = [
                    { x: goal.x + 1, y: goal.y },
                    { x: goal.x - 1, y: goal.y },
                    { x: goal.x, y: goal.y + 1 },
                    { x: goal.x, y: goal.y - 1 }
                ].filter(p => engine.inBounds(p.x, p.y));
                const breachables = neighbors.filter(n => {
                    const w = engine.getWallBetween(n.x, n.y, goal.x, goal.y);
                    return !!(w && w.owner === 'neutral');
                });
                if (breachables.length > 0) {
                    breachTarget = breachables.reduce((acc, n) => {
                        const dAcc = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
                        const dN = Math.abs(unit.position.x - n.x) + Math.abs(unit.position.y - n.y) + 3;
                        return dN < dAcc ? n : acc;
                    }, breachables[0]);
                }
            }
            const adjDirs = [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 }
            ];
            // CRITICAL LOGIC: Forest access via wall breach (neutral/player). Preserves expansion pressure.
            for (const dxy of adjDirs) {
                const fTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
                if (!engine.inBounds(fTile.x, fTile.y)) continue;
                if (!engine.isForest(fTile.x, fTile.y)) continue;
                const occupant = engine.getUnitAt(fTile.x, fTile.y);
                if (occupant) continue;
                const wall = engine.getWallBetween(unit.position.x, unit.position.y, fTile.x, fTile.y);
                if (wall && (wall.owner === 'neutral' || wall.owner === 'ai')) {
                    const score = (unit.tier >= 3 ? 7000000 : 900000) + aggressiveBonus;
                    const reason = wall.owner === 'ai' ? 'Sabotage Own Wall to Forest' : 'Breach Neutral Wall to Forest';
                    if (best === null || score > best.score) {
                        best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: fTile } };
                    }
                        } else if (wall && wall.owner === 'player') {
                    const neighbors: Position[] = [
                        { x: fTile.x + 1, y: fTile.y },
                        { x: fTile.x - 1, y: fTile.y },
                        { x: fTile.x, y: fTile.y + 1 },
                        { x: fTile.x, y: fTile.y - 1 }
                    ].filter(p => engine.inBounds(p.x, p.y));
                    const alternatives = neighbors.filter(n => {
                        if (engine.getUnitAt(n.x, n.y)) return false;
                        const w2 = engine.getWallBetween(n.x, n.y, fTile.x, fTile.y);
                        return !w2;
                    });
                    const dDirect = Math.abs(unit.position.x - fTile.x) + Math.abs(unit.position.y - fTile.y);
                    const dAlt = alternatives.length > 0
                        ? alternatives.reduce((acc, n) => {
                            const d = Math.abs(unit.position.x - n.x) + Math.abs(unit.position.y - n.y) + 1;
                            return Math.min(acc, d);
                        }, Infinity)
                        : Infinity;
                            if (dAlt - dDirect > 4) {
                                const score = (unit.tier >= 3 ? 8000000 : ((unit.tier === 3 && unit.level === 1) ? 1050000 : 850000)) + aggressiveBonus;
                        const reason = 'Attack Player Wall to Forest';
                        if (best === null || score > best.score) {
                            best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: fTile } };
                        }
                    }
                }
            }
            // Base adjacency breach for hunters
            // CRITICAL LOGIC: Base siege breach. Enables high-tier units to attack the base directly.
            for (const dxy of adjDirs) {
                const bTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
                if (bTile.x === playerBase.x && bTile.y === playerBase.y) {
                    const w = engine.getWallBetween(unit.position.x, unit.position.y, bTile.x, bTile.y);
                    if (w && (w.owner === 'neutral' || w.owner === 'player') && unit.tier >= 3) {
                        const score = 8000000 + aggressiveBonus;
                        const reason = 'Breach Wall to Base';
                        if (best === null || score > best.score) {
                            best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: bTile } };
                        }
                    }
                }
            }
            // Anti-clustering fallback near goal
            if (goal) {
                const sx = Math.sign(goal.x - unit.position.x);
                const sy = Math.sign(goal.y - unit.position.y);
                const nx = unit.position.x + (sx !== 0 ? sx : 0);
                const ny = unit.position.y + (sy !== 0 ? sy : 0);
                if (engine.inBounds(nx, ny)) {
                    const blocker = engine.getUnitAt(nx, ny);
                    if (blocker && blocker.owner === 'ai') {
                        for (const dxy of adjDirs) {
                            const nTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
                            if (!engine.inBounds(nTile.x, nTile.y)) continue;
                            const wAdj = engine.getWallBetween(unit.position.x, unit.position.y, nTile.x, nTile.y);
                            if (wAdj && (wAdj.owner === 'player' || wAdj.owner === 'neutral')) {
                                const bonus = wAdj.owner === 'player' ? 650000 : 600000;
                                const score = bonus + aggressiveBonus;
                                const reason = 'Anti-Clustering: Adjacent Wall Attack';
                                if (best === null || score > best.score) {
                                    best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: nTile } };
                                }
                            }
                        }
                    }
                }
            }
            // Wall Breaker: Path to Goal blocked
            // CRITICAL LOGIC: Wall Breaker — target blocking edges to prevent idle hunters.
            if (goal) {
                const dx = goal.x - unit.position.x;
                const dy = goal.y - unit.position.y;

                // 1. Cardinal Obstruction
                if ((dx !== 0 && dy === 0) || (dx === 0 && dy !== 0)) {
                    const stepX = Math.sign(dx);
                    const stepY = Math.sign(dy);
                    const nTile = { x: unit.position.x + stepX, y: unit.position.y + stepY };
                    if (engine.inBounds(nTile.x, nTile.y)) {
                        const w = engine.getWallBetween(unit.position.x, unit.position.y, nTile.x, nTile.y);
                        if (w) {
                            const score = (unit.tier >= 3 ? 8000000 : 1500000) + aggressiveBonus;
                            const reason = 'Wall Breaker: Unblock Path';
                            if (best === null || score > best.score) {
                                best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: nTile } };
                            }
                        }
                    }
                }

                // 2. Diagonal Obstruction
                if (Math.abs(dx) >= 1 && Math.abs(dy) >= 1) {
                    const stepX = Math.sign(dx);
                    const stepY = Math.sign(dy);
                    const diagTile = { x: unit.position.x + stepX, y: unit.position.y + stepY };

                    if (engine.inBounds(diagTile.x, diagTile.y)) {
                        const blocked = this.combat.isDiagonalBlocked(unit.position, diagTile, (x1, y1, x2, y2) => engine.getWallBetween(x1, y1, x2, y2));

                        if (blocked) {
                            const n1 = { x: unit.position.x + stepX, y: unit.position.y };
                            const n2 = { x: unit.position.x, y: unit.position.y + stepY };
                            const w1 = engine.getWallBetween(unit.position.x, unit.position.y, n1.x, n1.y);
                            const w2 = engine.getWallBetween(unit.position.x, unit.position.y, n2.x, n2.y);

                            let targetEdge = null;
                            if (w1) targetEdge = { from: { ...unit.position }, to: n1 };
                            else if (w2) targetEdge = { from: { ...unit.position }, to: n2 };

                            if (targetEdge) {
                                const score = (unit.tier >= 3 ? 8000000 : 1500000) + aggressiveBonus;
                                const reason = 'Wall Breaker: Unblock Diagonal Path';
                                if (best === null || score > best.score) {
                                    best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: targetEdge };
                                }
                            }
                        }
                    }
                }
            }
            // Anti-stagnation: break out from neutral walls near base or with no clear forest path
            const noClearForestPath = visibleFree.length === 0 && fogForests.length === 0 && !breachTarget;
            // CRITICAL LOGIC: Anti-stagnation near base — break neutral cages to regain mobility.
            if (stagnantTurns >= 2 && (noClearForestPath || playerUnits.length > 0)) {
                for (const dxy of adjDirs) {
                    const nTile = { x: unit.position.x + dxy.x, y: unit.position.y + dxy.y };
                    if (!engine.inBounds(nTile.x, nTile.y)) continue;
                    const w = engine.getWallBetween(unit.position.x, unit.position.y, nTile.x, nTile.y);
                    if (w && (w.owner === 'neutral' || w.owner === 'player')) {
                        const score = (unit.tier >= 3 ? 8000000 : 1200000);
                        const reason = 'Anti-Stagnation: Break Obstacle';
                        if (best === null || score > best.score) {
                            best = { unit, target: { x: unit.position.x, y: unit.position.y }, score, type: 'wall_attack', reason, edge: { from: { ...unit.position }, to: nTile } };
                        }
                    }
                }
            }
            const adjacentEnemies = playerUnits.filter(p => Math.max(Math.abs(p.position.x - unit.position.x), Math.abs(p.position.y - unit.position.y)) === 1);
            const strongestAdjEnemy = adjacentEnemies.length > 0 ? adjacentEnemies.reduce((acc, e) => (this.combat.calculateTotalPoints(e) > this.combat.calculateTotalPoints(acc) ? e : acc), adjacentEnemies[0]) : null;
            const canReachBlockingTile = blockingTiles.length > 0 && moves.some(m => blockingTiles.some(b => b.x === m.x && b.y === m.y));
            for (const move of moves) {
                let score = 0;
                let reason = 'Action';
                const targetUnit = engine.getUnitAt(move.x, move.y);
                const emptyAdjacentsAt = (p: Position) => {
                    const adj = [
                        { x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y },
                        { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }
                    ].filter(pp => engine.inBounds(pp.x, pp.y));
                    return adj.filter(a => !engine.getUnitAt(a.x, a.y)).length;
                };
                const baseDistCurr = Math.max(Math.abs(unit.position.x - aiBase.x), Math.abs(unit.position.y - aiBase.y));
                const baseDistMove = Math.max(Math.abs(move.x - aiBase.x), Math.abs(move.y - aiBase.y));
                const nearestForestCurrent = forests.length ? Math.min(...forests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
                const nearestForestMove = forests.length ? Math.min(...forests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
                const playerOwnedForests = forests.filter(f => {
                    const u = engine.getUnitAt(f.x, f.y);
                    return !!u && u.owner === 'player';
                });
                const nearestPlayerForestCurrent = playerOwnedForests.length ? Math.min(...playerOwnedForests.map(f => Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y))) : Infinity;
                const nearestPlayerForestMove = playerOwnedForests.length ? Math.min(...playerOwnedForests.map(f => Math.abs(move.x - f.x) + Math.abs(move.y - f.y))) : Infinity;
                const histMap = new Map(engine.unitMoveHistorySignal());
                const histRaw = histMap.get(unit.id);
                const hist: Position[] = Array.isArray(histRaw) ? (histRaw as Position[]) : [];
                const prevTile = hist.length >= 2 ? hist[hist.length - 2] : null;
                const prevPrevTile = hist.length >= 3 ? hist[hist.length - 3] : null;
                const returning = prevTile && move.x === prevTile.x && move.y === prevTile.y;
                const leavingForest = isOnForest && !(engine.isForest(move.x, move.y));
                if (fullRushActive) {
                    const dBaseCurr = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
                    const dBaseMove = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
                    
                    // Dominant factor: Distance to Player Base
                    if (dBaseMove < dBaseCurr) {
                        score += 50000000; // Massive boost for moving closer
                        reason = 'FULL RUSH: Charge Base';
                    } else if (dBaseMove === dBaseCurr) {
                        // Neutral move is okay if it positions better, but prefer forward
                        score += 100000; 
                    } else {
                        score -= 5000000; // Penalize moving away
                    }
                    
                    // Attack units blocking path to base
                    if (targetUnit && targetUnit.owner === 'player') {
                        // Check if this enemy is roughly in direction of base
                        const enemyDistBase = Math.abs(targetUnit.position.x - playerBase.x) + Math.abs(targetUnit.position.y - playerBase.y);
                        if (enemyDistBase < dBaseCurr) {
                            score += 20000000;
                            reason = 'FULL RUSH: Clear Path to Base';
                        }
                    }

                    // Less inclined to stay in forests unless low income
                    if (isOnForest && move.x === unit.position.x && move.y === unit.position.y) {
                         // If we have plenty of forests, don't just camp
                         if (aiForestCount >= 3) {
                             score = -5000000; // Force move out
                             reason = 'FULL RUSH: Abandon Forest for Assault';
                         }
                    }
                } else {
                    if (unit.tier >= 3 && leavingForest) {
                        const canReachBaseSoon = (Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y)) <= 2;
                        const nearEnemySoon = playerUnits.some((p: Unit) => (Math.abs(move.x - p.position.x) + Math.abs(move.y - p.position.y)) <= 2);
                        const replacementReady = engine.unitsSignal().some((u2: Unit) =>
                            u2.owner === 'ai' && u2.id !== unit.id &&
                            Math.max(Math.abs(u2.position.x - unit.position.x), Math.abs(u2.position.y - unit.position.y)) <= 1
                        );
                        if (!forestsSecured && !(canReachBaseSoon || nearEnemySoon) && !replacementReady) {
                            score -= 2000000;
                            reason = 'Penalty: Leaving forest without replacement';
                        }
                    }
                }
                const banInfo = stutterBan.get(unit.id);
                const bannedNow = banInfo && banInfo.until > engine.turnSignal() && banInfo.tiles.has(`${move.x},${move.y}`);
                const loopLastTwo = unit.tier === 1 && ((prevTile && move.x === prevTile.x && move.y === prevTile.y) || (prevPrevTile && move.x === prevPrevTile.x && move.y === prevPrevTile.y));
                if (loopLastTwo) {
                    score -= 25000;
                    reason = 'Anti-Loop Penalty';
                }
                if (unit.tier <= 2 && !targetUnit && prevPrevTile && move.x === prevPrevTile.x && move.y === prevPrevTile.y) {
                    score = -1000000;
                    reason = 'Anti-Loop: Stay or different path';
                }
                if (bannedNow) {
                    score -= 30000;
                    reason = 'Stutter Ban Penalty';
                }
                if (isOnForest && adjacentEnemies.length === 0 && !targetUnit && leavingForest && !baseThreat) {
                    score = -1000;
                }
                if (isOnForest && unit.tier <= 2 && leavingForest && adjacentEnemies.length > 0) {
                    const threatening = adjacentEnemies.some(e => this.combat.calculateTotalPoints(e) > this.combat.calculateTotalPoints(unit));
                    if (threatening) {
                        score = -1000000;
                        reason = 'Hold Forest';
                    }
                }
                if (fullRushActive) {
                    if (isOnForest && move.x === unit.position.x && move.y === unit.position.y) {
                         // If we have plenty of forests, don't just camp
                         if (aiForestCount >= 3) {
                             score = -5000000; // Force move out
                             reason = 'FULL RUSH: Abandon Forest for Assault';
                         }
                    }
                } else if (!targetUnit) {
                    if (isOnForest && move.x === unit.position.x && move.y === unit.position.y) {
                        const strongerAdj = adjacentEnemies.some(e => this.combat.calculateTotalPoints(e) > this.combat.calculateTotalPoints(unit));
                        const allowHunt = forestsSecured && unit.tier >= 3;
                        if (!strongerAdj && !allowHunt) {
                            score = Math.max(score, 10000000);
                            reason = 'Hold: Stay on forest';
                        }
                    }
                }
                if (!targetUnit && !fullRushActive) { // Only do normal forest capture logic if not rushing
                    if (engine.isForest(move.x, move.y) && !engine.getUnitAt(move.x, move.y)) {
                        if (totalWar) {
                            score = -1000;
                            reason = 'Ignore Forest (Total War)';
                        } else if (unit.tier >= 3) {
                            const mult = (isEarlyGame && !baseThreat) ? 3 : 1;
                            score = 5000000 * mult;
                            reason = 'Priority: T3 capture empty forest';
                        } else {
                            const mult = (isEarlyGame && !baseThreat) ? 3 : 1;
                            score = 1000000 * mult;
                            reason = aiForestCount < 3 ? `Priority 0: Capture Forest ${move.x},${move.y}` : `Priority 1: Capture Forest ${move.x},${move.y}`;
                            if (isEarlyGame && !baseThreat) {
                                const stepDist = Math.abs(unit.position.x - move.x) + Math.abs(unit.position.y - move.y);
                                if (stepDist === 1) {
                                    score = Math.max(score, 12000000);
                                    reason = `Early Capture: Forest ${move.x},${move.y}`;
                                }
                            }
                        }
                    }
                    if (goal) {
                        const dCurr = Math.abs(unit.position.x - goal.x) + Math.abs(unit.position.y - goal.y);
                        const dMove = Math.abs(move.x - goal.x) + Math.abs(move.y - goal.y);
                        if (dMove < dCurr) {
                            score += 50000 * (dCurr - dMove);
                            reason = visibleFree.length > 0 ? `Priority 1: Toward Forest ${goal.x},${goal.y}` : (fogForests.length > 0 ? `Priority 7: Toward Fog Forest ${goal.x},${goal.y}` : `Toward Goal ${goal.x},${goal.y}`);
                        }
                        // Anti-stall aggression and unblocking when crowded or caps reached
                        if (aiTotalUnits > 10 || capReachedAny) {
                            const dBaseCurr = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
                            const dBaseMove = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
                            if (dBaseMove < dBaseCurr) {
                                score += 150000 * (dBaseCurr - dBaseMove);
                                reason = 'Aggress: Toward Player Base';
                            }
                            if (nearestPlayerForestMove < nearestPlayerForestCurrent) {
                                score += 120000 * (nearestPlayerForestCurrent - nearestPlayerForestMove);
                                reason = 'Aggress: Toward Player Forest';
                            }
                            const outernessGain = emptyAdjacentsAt(move) - emptyAdjacentsAt(unit.position);
                            if (outernessGain > 0) {
                                score += 50000 * outernessGain;
                                reason = 'Unblock: Clear path';
                            }
                        }
                        const towardGoalWall = (() => {
                            const sx = Math.sign(goal.x - unit.position.x);
                            const sy = Math.sign(goal.y - unit.position.y);
                            const nx = unit.position.x + (sx !== 0 ? sx : 0);
                            const ny = unit.position.y + (sy !== 0 ? sy : 0);
                            if (!engine.inBounds(nx, ny)) return false;
                            const w = engine.getWallBetween(unit.position.x, unit.position.y, nx, ny);
                            return !!w;
                        })();
                        if (towardGoalWall && move.x === unit.position.x && move.y === unit.position.y) {
                            const w = engine.getWallBetween(unit.position.x, unit.position.y, unit.position.x + Math.sign(goal.x - unit.position.x), unit.position.y + Math.sign(goal.y - unit.position.y));
                            const owner = w?.owner;
                            if (unit.tier >= 3) {
                                score = Math.max(score, 8000000 + aggressiveBonus);
                                reason = 'Breach: Wall blocks high-priority path';
                            } else {
                                const base = owner === 'ai' ? 700000 : 800000;
                                score += base + aggressiveBonus;
                                reason = owner === 'ai' ? 'Sabotage: Own Wall Blocks Path' : 'Siege: Breakthrough';
                            }
                        }
                    }
                    if (breachTarget) {
                        const dBCurr = Math.abs(unit.position.x - breachTarget.x) + Math.abs(unit.position.y - breachTarget.y);
                        const dBMove = Math.abs(move.x - breachTarget.x) + Math.abs(move.y - breachTarget.y);
                        if (dBMove < dBCurr) {
                            score += 200000 * (dBCurr - dBMove);
                            reason = 'Approach Neutral Wall to Forest';
                        }
                        if (move.x === breachTarget.x && move.y === breachTarget.y) {
                            score += 500000;
                            reason = 'Position for Wall Breach';
                        }
                    }
                    if (move.x === playerBase.x && move.y === playerBase.y) {
                        score += 10000;
                        reason = 'Attack Base (Override)';
                    }
                    if (primaryThreat) {
                        const isBlocking = blockingTiles.some(b => b.x === move.x && b.y === move.y);
                        const distCurrThreat = Math.abs(unit.position.x - primaryThreat.position.x) + Math.abs(unit.position.y - primaryThreat.position.y);
                        const distMoveThreat = Math.abs(move.x - primaryThreat.position.x) + Math.abs(move.y - primaryThreat.position.y);
                        const threatDistToBase = Math.max(Math.abs(primaryThreat.position.x - aiBase.x), Math.abs(primaryThreat.position.y - aiBase.y));
                        const threatNextTurn = threatDistToBase <= 2;
                        const staying = move.x === unit.position.x && move.y === unit.position.y;

                        // T3 Intercept Logic
                        if (unit.tier >= 3 && primaryThreat.tier >= 3 && distMoveThreat === 1) {
                            score = 40000000; // High priority to get adjacent (prepare to attack next turn or block)
                            reason = 'DEFENSE: T3 Move to Intercept Threat';
                        }
                        else if (isBlocking) {
                            const baseScore = threatNextTurn ? 2500000 : 1500000;
                            if (score < baseScore) {
                                score = baseScore;
                            }
                            score += threatNextTurn ? 20000 : 5000;
                            reason = threatNextTurn ? 'Panic Defense: Block Path To Base' : 'Defense: Block Path To Base';
                        } else if (distMoveThreat < distCurrThreat) {
                            const bonus = (unit.id === (strongestAi?.id ?? '')) ? 1000000 : 5000;
                            score += bonus * (distCurrThreat - distMoveThreat);
                            if (unit.tier >= 3) score += 4000;
                            reason = unit.id === (strongestAi?.id ?? '') ? 'DEFENSE: Strongest Intercept' : 'Defense: Move Toward Base Threat';
                        }
                        if (staying && canReachBlockingTile) {
                            score -= threatNextTurn ? 50000 : 10000;
                            if (immediateThreat) {
                                reason = 'Penalty: Standing Still With Imminent Base Threat';
                            } else if (baseThreat) {
                                reason = 'Penalty: Standing Still With Base Threat';
                            }
                        }
                    }
                    if (unit.tier >= 3) {
                        const bCurr = Math.abs(unit.position.x - playerBase.x) + Math.abs(unit.position.y - playerBase.y);
                        const bMove = Math.abs(move.x - playerBase.x) + Math.abs(move.y - playerBase.y);
                        if (bMove < bCurr) {
                            score += 2000 * (bCurr - bMove);
                            reason = 'Hunter: Toward Base';
                            if (forestsSecured) {
                                score = Math.max(score, 4000000);
                                reason = 'Hunt: Approach Base';
                            }
                        }
                    }
                    if (nearBase && nearestForestMove < nearestForestCurrent) {
                        score *= 10;
                    }
                    if (baseDistMove > baseDistCurr && nearestForestMove < nearestForestCurrent) {
                        score += 500;
                    }
                    if (strongestAdjEnemy && this.combat.calculateTotalPoints(strongestAdjEnemy) > this.combat.calculateTotalPoints(unit)) {
                        const dCurrSE = Math.abs(unit.position.x - strongestAdjEnemy.position.x) + Math.abs(unit.position.y - strongestAdjEnemy.position.y);
                        const dMoveSE = Math.abs(move.x - strongestAdjEnemy.position.x) + Math.abs(move.y - strongestAdjEnemy.position.y);
                        if (dMoveSE > dCurrSE) {
                            score += 75000 * (dMoveSE - dCurrSE);
                            reason = 'Retreat';
                        }
                    }
                } else {
                    if (targetUnit.owner === 'player') {
                        const distTargetBase = Math.max(Math.abs(targetUnit.position.x - aiBase.x), Math.abs(targetUnit.position.y - aiBase.y));
                        const targetThreateningBase = distTargetBase <= 3;
                        const targetCanReachBaseNextTurn = distTargetBase <= 2;

                        const myPoints = this.combat.calculateTotalPoints(unit);
                        const enemyPoints = this.combat.calculateTotalPoints(targetUnit);
                        const canKill = myPoints > enemyPoints;
                        const isHighValue = targetUnit.tier >= 3;
                        const isMyHighValue = unit.tier >= 3;

                        if (unit.tier >= 3 && engine.isForest(targetUnit.position.x, targetUnit.position.y)) {
                            score = 10000000;
                            reason = 'Aggression: Liberate forest';
                        }
                        if (!isOnForest && forestsAllOccupied && playerOwnedForests.length > 0 && engine.isForest(targetUnit.position.x, targetUnit.position.y)) {
                            score = 12000000;
                            reason = 'LIBERATE: Attack player forest';
                        }
                        // 0. Intercept within 4 tiles (assist)
                        if (distTargetBase <= 4) {
                            if (unit.tier >= 3 || canKill) {
                                score = 15000000;
                                reason = 'INTERCEPT: Base Siege';
                            }
                        }
                        // 1. Base Defense (Top Priority)
                        if (targetThreateningBase) {
                            // SPECIAL RULE: T3 vs T3 (Highest Priority)
                            if (isMyHighValue && isHighValue) {
                                score = 50000000;
                                reason = 'CRITICAL DEFENSE: T3 Intercepts Threat';
                            }
                            else {
                                // T1/T2 or T3 vs Weaker Threat
                                if (canKill) {
                                    score = 20000000;
                                    reason = 'CRITICAL DEFENSE: Eliminate Base Threat';
                                    if (targetCanReachBaseNextTurn) score += 5000000;
                                } else {
                                    // Suicide check
                                    if (isHighValue && unit.tier <= 2) {
                                        // User Rule: "T1 Units: Do NOT waste the turn attacking a full-health T3"
                                        score = 0;
                                        reason = 'Ignore: T1 Suicide vs T3 useless';
                                    } else {
                                        // Desperation attack if it's the only option?
                                        score = 1000;
                                        reason = 'DEFENSE: Desperation Attack';
                                    }
                                }
                            }
                        }
                        // 2. Kill Potential & High Value Targets
                        else {
                            if (canKill) {
                                if (isHighValue) {
                                    score = 8000000; // Killing a T3 is HUGE
                                    reason = 'COMBAT: Kill High Value Target (T3+)';
                                } else {
                                    score = 4000000; // Killing T1/T2
                                    reason = 'COMBAT: Kill Enemy';
                                }

                                // Trade Efficiency Bonus
                                if (unit.tier < targetUnit.tier) {
                                    score += 2000000; // T1 kills T2 = Amazing
                                    reason += ' (Efficient Trade)';
                                }
                            } else {
                                if (unit.tier <= 2) {
                                    score = 0;
                                    reason = 'Ignore: No guaranteed kill';
                                } else {
                                    score = 100000;
                                    reason = 'COMBAT: Chip Damage';
                                }
                            }
                        }

                        if (aggression) score += 500000;
                        if (enemyNearBase) score += 1000000;
                    } else {
                        if (targetUnit.tier === unit.tier && baseDistMove > baseDistCurr) {
                            const mergedPoints = this.combat.calculateTotalPoints(unit) + this.combat.calculateTotalPoints(targetUnit);
                            const { tier } = this.combat.calculateTierAndLevel(mergedPoints);
                            if (tier > unit.tier && !nearBase && !isOnForest) {
                                score = 1000;
                                reason = 'Merge Up';
                            }
                        }
                    }
                }
                let type: 'move' | 'attack' | 'merge' = 'move';
                if (targetUnit && targetUnit.owner === 'player') type = 'attack';
                if (targetUnit && targetUnit.owner === 'ai' && targetUnit.tier === unit.tier) type = 'merge';
                if ((aiTotalUnits > 10 || capReachedAny) && type === 'merge') {
                    score += 5000000;
                    reason = 'Anti-Stall: Merge first';
                }
                const lockUntil = this.interceptUntil.get(unit.id) || 0;
                if (unit.id === (strongestAi?.id ?? '') && lockUntil > (typeof engine.turnSignal === 'function' ? engine.turnSignal() : 0)) {
                    if (primaryThreat) {
                        const distCurrThreat = Math.abs(unit.position.x - primaryThreat.position.x) + Math.abs(unit.position.y - primaryThreat.position.y);
                        const distMoveThreat = Math.abs(move.x - primaryThreat.position.x) + Math.abs(move.y - primaryThreat.position.y);
                        if (distMoveThreat < distCurrThreat) {
                            score += 500000 * (distCurrThreat - distMoveThreat);
                            reason = 'DEFENSE: Intercept Lock';
                        }
                    }
                }
                if (returning) {
                    score = Math.floor(score * 0.1);
                    score -= 300000;
                    reason = 'Penalty: Inertia';
                }
                const histLoop3 = (() => {
                    const last6 = hist.slice(-6);
                    const uniq = new Set(last6.map(p => `${p.x},${p.y}`));
                    return last6.length >= 6 && uniq.size <= 3;
                })();
                if (unit.tier === 1 && histLoop3) {
                    const candidates = visibleFree.length > 0 ? visibleFree : fogForests;
                    if (candidates.length > 0) {
                        const nearest = candidates.reduce((acc, f) => {
                            const d = Math.abs(unit.position.x - f.x) + Math.abs(unit.position.y - f.y);
                            const da = Math.abs(unit.position.x - acc.x) + Math.abs(unit.position.y - acc.y);
                            return d < da ? f : acc;
                        }, candidates[0]);
                        const dCurr = Math.abs(unit.position.x - nearest.x) + Math.abs(unit.position.y - nearest.y);
                        const dMove = Math.abs(move.x - nearest.x) + Math.abs(move.y - nearest.y);
                        if (dMove < dCurr) {
                            score += 100000 * (dCurr - dMove);
                            reason = 'Breakout: Toward Forest';
                        }
                    }
                }
                if ((unit.forestOccupationTurns ?? 0) > 0 && (move.x !== unit.position.x || move.y !== unit.position.y)) {
                    score -= 2000;
                }
                if (best === null || score > best.score) {
                    best = { unit, target: move, score, type, reason };
                }
            }
        }
        if (!best) return null;
        const goal = this.goals.get(best.unit.id);
        const goalText = goal ? `Goal: Forest at ${goal.x},${goal.y}` : 'Goal: None';
        // CRITICAL LOGIC: Final decision logging aids telemetry and debugging of AI pathing.
        // console.log(`[AI Decision] Unit ${best.unit.id} moving to (${best.target.x},${best.target.y}) targeting ${goalText}.`);
        return { type: best.type, unit: best.unit, target: best.target, reason: best.reason, edge: (best as any).edge };
    }

    getWallBuildActions(engine: any): { from: Position; to: Position }[] {
        const actions: { from: Position; to: Position }[] = [];
        const aiUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'ai');
        const playerUnits = engine.unitsSignal().filter((u: Unit) => u.owner === 'player');
        const walls = engine.wallsSignal();
        const totalWar = typeof engine.totalWarMode === 'function' ? engine.totalWarMode() : false;

        // Helper to check if wall exists
        const hasWall = (p1: Position, p2: Position) => walls.some((w: any) =>
            (w.tile1.x === p1.x && w.tile1.y === p1.y && w.tile2.x === p2.x && w.tile2.y === p2.y) ||
            (w.tile1.x === p2.x && w.tile1.y === p2.y && w.tile2.x === p1.x && w.tile2.y === p1.y)
        );
        // Helper to check distance (Manhattan)
        const dist = (p1: Position, p2: Position) => Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
        // Helper to check Chebyshev distance (for "within 2 cells")
        const maxDist = (p1: Position, p2: Position) => Math.max(Math.abs(p1.x - p2.x), Math.abs(p1.y - p2.y));

        for (const unit of aiUnits) {
            // Rule 6: Level 3+ prohibited from building walls
            if (unit.tier >= 3) continue;

            const neighbors = [
                { x: unit.position.x + 1, y: unit.position.y },
                { x: unit.position.x - 1, y: unit.position.y },
                { x: unit.position.x, y: unit.position.y + 1 },
                { x: unit.position.x, y: unit.position.y - 1 }
            ].filter(p => engine.inBounds(p.x, p.y));

            if (totalWar && engine.isForest(unit.position.x, unit.position.y)) {
                for (const n of neighbors) {
                    if (!hasWall(unit.position, n) && engine.canBuildWallBetween(unit.position, n)) {
                        actions.push({ from: unit.position, to: n });
                    }
                }
                continue;
            }

            // Check for nearby enemies (within 2 cells)
            const nearbyEnemies = playerUnits.filter((p: Unit) => maxDist(unit.position, p.position) <= 2);
            if (nearbyEnemies.length === 0) continue;

            const closestEnemy = nearbyEnemies.sort((a: Unit, b: Unit) => dist(unit.position, a.position) - dist(unit.position, b.position))[0];

            // Determine "attacker's side" by sorting neighbors by distance to enemy
            const sortedNeighbors = neighbors.sort((a, b) => dist(a, closestEnemy.position) - dist(b, closestEnemy.position));

            // Level 1 on Forest: Build walls on all 4 sides
            if (unit.tier === 1 && engine.isForest(unit.position.x, unit.position.y)) {
                for (const n of sortedNeighbors) {
                    if (!hasWall(unit.position, n) && engine.canBuildWallBetween(unit.position, n)) {
                        actions.push({ from: unit.position, to: n });
                    }
                }
            }
            // Level 2: Build max 2 walls on attacker's side
            else if (unit.tier === 2) {
                let count = 0;
                for (const n of sortedNeighbors) {
                    if (count >= 2) break;
                    if (!hasWall(unit.position, n) && engine.canBuildWallBetween(unit.position, n)) {
                        actions.push({ from: unit.position, to: n });
                        count++;
                    }
                }
            }
        }
        return actions;
    }
}
