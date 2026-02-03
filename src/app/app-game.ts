import { Component, ElementRef, ViewChild, isDevMode, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameRulesComponent } from './components/game-rules/game-rules.component';
import { GameEngineService } from './services/game-engine.service';
import { SettingsService } from './services/settings.service';
import { FirebaseService } from './services/firebase.service';
import { SupportCommunityComponent } from './components/support-community/support-community.component';
import { LeaderboardModalComponent } from './components/leaderboard-modal/leaderboard-modal.component';
import { UnitsComponent } from './components/units/units.component';
import { SandboxComponent } from './components/sandbox/sandbox.component';

@Component({
    selector: 'app-game',
    standalone: true,
    imports: [CommonModule, GameRulesComponent, SupportCommunityComponent, LeaderboardModalComponent, UnitsComponent, SandboxComponent],
    templateUrl: './app-game.html',
    styleUrl: './app.css'
})
export class AppGame {
    @ViewChild('boardContainer') boardContainer?: ElementRef<HTMLDivElement>;

    isAutoBattleActive = signal(false);
    isMobileMenuOpen = signal(false);

    constructor(
        public gameEngine: GameEngineService,
        public settings: SettingsService,
        public firebase: FirebaseService,
        private router: Router
    ) {
    }

    get isProduction() {
        return !isDevMode();
    }

    toggleMobileMenu() {
        this.isMobileMenuOpen.update(v => !v);
    }
    closeMobileMenu() {
        this.isMobileMenuOpen.set(false);
    }

    toggleAutoBattle() {
        this.isAutoBattleActive.update(v => !v);
        if (this.isAutoBattleActive()) {
            this.executeAutoMoveLoop();
        }
    }

    navigateToFeedback() {
        const user = this.firebase.user$();
        if (user) {
            this.router.navigate(['/feedback']);
            return;
        }
        try {
            this.firebase.loginWithGoogle();
        } catch {}
    }
    navigateToRoadmap() {
        this.router.navigate(['/roadmap']);
    }

    ngAfterViewInit() {
        setTimeout(() => {
            const el: any = this.boardContainer?.nativeElement;
            if (typeof window !== 'undefined' && el && typeof el.scrollTo === 'function') {
                el.scrollTo({ left: 0, top: 0 });
            }
        }, 0);
    }

    private centerOnSelectedUnit() {
        const el = this.boardContainer?.nativeElement;
        if (!el) return;
        const unit = this.gameEngine.selectedUnit();
        if (!unit) return;
        const tile = this.gameEngine.tileSizePx;
        const gap = this.gameEngine.wallThicknessPx + 2;
        const step = tile + gap;
        const centerX = unit.position.x * step + tile / 2;
        const centerY = unit.position.y * step + tile / 2;
        const targetLeft = Math.max(0, Math.min(centerX - el.clientWidth / 2, el.scrollWidth - el.clientWidth));
        const targetTop = Math.max(0, Math.min(centerY - el.clientHeight / 2, el.scrollHeight - el.clientHeight));
        el.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' });
    }

    private activeKeys = new Set<string>();
    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        if (this.gameEngine.gameStatus() !== 'playing') return;
        const key = event.key;
        if (key === 'Tab' || key === ' ' || event.code === 'Space') {
            event.preventDefault();
            if (this.gameEngine.isPlayerTurn()) {
                this.gameEngine.selectNextAvailableUnit();
                this.centerOnSelectedUnit();
            }
            return;
        }
        if (key === 'Enter') {
            event.preventDefault();
            this.gameEngine.endPlayerTurn();
            return;
        }
        const unit = this.gameEngine.selectedUnit();
        if (!unit || unit.hasActed) return;
        this.activeKeys.add(key);
        let dx = 0, dy = 0;
        if (this.activeKeys.has('ArrowUp') || this.activeKeys.has('w') || this.activeKeys.has('W')) dy -= 1;
        if (this.activeKeys.has('ArrowDown') || this.activeKeys.has('s') || this.activeKeys.has('S')) dy += 1;
        if (this.activeKeys.has('ArrowLeft') || this.activeKeys.has('a') || this.activeKeys.has('A')) dx -= 1;
        if (this.activeKeys.has('ArrowRight') || this.activeKeys.has('d') || this.activeKeys.has('D')) dx += 1;
        if (dx === 0 && dy === 0) return;
        event.preventDefault();
        const moves = this.gameEngine.validMoves();
        const isDiagonal = dx !== 0 && dy !== 0;
        const maxSteps = isDiagonal ? (unit.tier === 4 ? 3 : 1) : (unit.tier >= 3 ? 2 : unit.tier === 2 ? 2 : 1);
        let target = null as { x: number; y: number } | null;
        for (let step = 1; step <= maxSteps; step++) {
            const tx = unit.position.x + dx * step;
            const ty = unit.position.y + dy * step;
            const candidate = { x: tx, y: ty };
            if (moves.some(m => m.x === tx && m.y === ty)) {
                target = candidate;
            } else {
                break;
            }
        }
        if (!target) {
            const from = { x: unit.position.x, y: unit.position.y };
            const to = { x: unit.position.x + dx, y: unit.position.y + dy };
            const wall = this.gameEngine.getWallBetween(from.x, from.y, to.x, to.y);
            if (wall) {
                this.gameEngine.attackOrDestroyWallBetween(from, to);
                return;
            }
            const tu = this.gameEngine.getUnitAt(to.x, to.y);
            if (tu && tu.owner !== unit.owner) {
                this.gameEngine.moveSelectedUnit(to);
                return;
            }
            if (this.gameEngine.isValidMove(to.x, to.y)) {
                this.gameEngine.moveSelectedUnit(to);
            }
            return;
        }
        this.gameEngine.moveSelectedUnit(target);
    }
    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent) {
        this.activeKeys.delete(event.key);
    }
    onDifficultyChange(diff: any) {
        this.settings.setDifficulty(diff);
        this.gameEngine.resetGame();
    }

    onMapSizeChange(size: number) {
        this.settings.setMapSize(size as any);
        setTimeout(() => {
            const el: any = this.boardContainer?.nativeElement;
            if (typeof window !== 'undefined' && el && typeof el.scrollTo === 'function') {
                el.scrollTo({ left: 0, top: 0 });
            }
        }, 0);
        this.gameEngine.resetGame();
    }

    onTileClick(x: number, y: number) {
        if (this.gameEngine.gameStatus() !== 'playing') return;
        if (this.settings.customMode() && this.gameEngine.sandboxSpawnPending()) {
            const occupied = this.gameEngine.getUnitAt(x, y);
            if (!occupied) {
                this.gameEngine.spawnSandboxAt({ x, y });
            }
            return;
        }

        if (this.gameEngine.isDeployTarget(x, y)) {
            this.gameEngine.deployTo({ x, y });
            return;
        }

        if (x === 0 && y === 0) {
            this.gameEngine.startDeployFromBase();
            return;
        }

        this.gameEngine.cancelDeploy();

        const unit = this.gameEngine.getUnitAt(x, y);

        // If a unit is selected and we click on a valid move tile, move it
        // PRIORITY: Valid Move > New Selection
        if (this.gameEngine.selectedUnit() && this.gameEngine.isValidMove(x, y)) {
            this.gameEngine.moveSelectedUnit({ x, y });
            return;
        }
        const sel = this.gameEngine.selectedUnit();
        if (sel) {
            const dx = x - sel.position.x;
            const dy = y - sel.position.y;
            if ((Math.abs(dx) + Math.abs(dy)) === 1) {
                const wall = this.gameEngine.getWallBetween(sel.position.x, sel.position.y, x, y);
                if (wall) {
                    this.gameEngine.attackOrDestroyWallBetween(sel.position, { x, y });
                    return;
                }
            }
        }

        // If clicking on a unit owned by player, select it
        if (unit && unit.owner === 'player') {
            this.gameEngine.selectUnit(unit.id);
            return;
        }

        // Clicking elsewhere deselects
        this.gameEngine.selectUnit(null);
    }
    setCustomMode(active: boolean) {
        this.settings.setCustomMode(active);
        this.gameEngine.resetGame();
    }

    onEdgeClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
        event.stopPropagation();
        if (this.gameEngine.gameStatus() !== 'playing') return;
        const wall = this.gameEngine.getWallBetween(x1, y1, x2, y2);
        if (wall) {
            this.gameEngine.attackOrDestroyWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
            return;
        }
        if (this.gameEngine.buildMode()) {
            this.gameEngine.buildWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
        }
    }

    onDestroyIconClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
        event.stopPropagation();
        if (this.gameEngine.gameStatus() !== 'playing') return;
        this.gameEngine.destroyOwnWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
    }

    onBuildIconClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
        event.stopPropagation();
        if (this.gameEngine.gameStatus() !== 'playing') return;
        if (!this.gameEngine.buildMode()) return;
        this.gameEngine.buildWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
    }

    onAttackIconClick(event: MouseEvent, x1: number, y1: number, x2: number, y2: number) {
        event.stopPropagation();
        if (this.gameEngine.gameStatus() !== 'playing') return;
        this.gameEngine.attackOrDestroyWallBetween({ x: x1, y: y1 }, { x: x2, y: y2 });
    }

    private async executeAutoMoveLoop() {
        while (this.isAutoBattleActive()) {
            await this.executeAutoMove();
        }
    }

    private async executeAutoMove() {
        await new Promise(res => setTimeout(res, 500));
        if (!this.isAutoBattleActive()) return;
        if (this.gameEngine.gameStatus() !== 'playing') return;
        if (!this.gameEngine.isPlayerTurn()) return;

        const units = this.gameEngine.units ? this.gameEngine.units() : [];
        const aiBase = this.gameEngine.getBasePosition('ai');
        const center = { x: Math.floor(this.gameEngine.gridSize / 2), y: Math.floor(this.gameEngine.gridSize / 2) };
        const enemies = units.filter(u => u.owner === 'ai');
        const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

        let bestScore = -Infinity;
        let bestUnitId: string | null = null;
        let bestMove: { x: number; y: number } | null = null;
        let bestTie = Infinity;
        let willAttack = false;

        for (const u of units) {
            if (u.owner !== 'player') continue;
            this.gameEngine.selectUnit(u.id);
            const moves = this.gameEngine.validMoves();
            if (moves.length === 0) continue;
            for (const m of moves) {
                let score = 0;
                const targetUnit = this.gameEngine.getUnitAt(m.x, m.y);
                const isBaseHit = m.x === aiBase.x && m.y === aiBase.y;
                const isAttack = !!(targetUnit && targetUnit.owner === 'ai') || isBaseHit;
                if (isAttack) {
                    score += 100;
                } else {
                    let nearest: { x: number; y: number } = aiBase;
                    let nearestD = dist(m, aiBase);
                    for (const e of enemies) {
                        const d = dist(m, e.position);
                        if (d < nearestD) {
                            nearestD = d;
                            nearest = e.position;
                        }
                    }
                    const currentD = dist(u.position, nearest);
                    if (nearestD < currentD) {
                        score += 50;
                    }
                    if (enemies.length === 0) {
                        const centerD = dist(m, center);
                        const currCenterD = dist(u.position, center);
                        const baseD = dist(m, aiBase);
                        const currBaseD = dist(u.position, aiBase);
                        if (centerD < currCenterD || baseD < currBaseD) {
                            score += 20;
                        }
                    }
                }
                const tie = isAttack ? 0 : Math.min(
                    ...[...enemies.map(e => dist(m, e.position)), dist(m, aiBase)]
                );
                if (score > bestScore || (score === bestScore && tie < bestTie)) {
                    bestScore = score;
                    bestUnitId = u.id;
                    bestMove = m;
                    bestTie = tie;
                    willAttack = isAttack;
                }
            }
        }

        if (bestUnitId && bestMove) {
            this.gameEngine.selectUnit(bestUnitId);
            if (willAttack) {
                try {
                    console.log('[AUTO_ENGAGE][АВТОПІЛОТ] Ціль захоплена. Починаю атаку...');
                } catch {}
            }
            this.gameEngine.moveSelectedUnit(bestMove);
        } else {
            this.gameEngine.selectUnit(null);
        }
    }
}
