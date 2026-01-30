import { Component, ElementRef, ViewChild, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { GameRulesComponent } from './components/game-rules/game-rules.component';
import { GameEngineService } from './services/game-engine.service';
import { SettingsService } from './services/settings.service';
import { FirebaseService } from './services/firebase.service';
import { SupportCommunityComponent } from './components/support-community/support-community.component';
import { LeaderboardModalComponent } from './components/leaderboard-modal/leaderboard-modal.component';

@Component({
    selector: 'app-game',
    standalone: true,
    imports: [CommonModule, RouterLink, GameRulesComponent, SupportCommunityComponent, LeaderboardModalComponent],
    templateUrl: './app-game.html',
    styleUrl: './app.css'
})
export class AppGame {
    @ViewChild('boardContainer') boardContainer?: ElementRef<HTMLDivElement>;

    constructor(
        public gameEngine: GameEngineService,
        public settings: SettingsService,
        public firebase: FirebaseService
    ) {
    }

    get isProduction() {
        return !isDevMode();
    }

    ngAfterViewInit() {
        setTimeout(() => {
            const el: any = this.boardContainer?.nativeElement;
            if (typeof window !== 'undefined' && el && typeof el.scrollTo === 'function') {
                el.scrollTo({ left: 0, top: 0 });
            }
        }, 0);
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

        // If clicking on a unit owned by player, select it
        if (unit && unit.owner === 'player') {
            this.gameEngine.selectUnit(unit.id);
            return;
        }

        // Clicking elsewhere deselects
        this.gameEngine.selectUnit(null);
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
}
