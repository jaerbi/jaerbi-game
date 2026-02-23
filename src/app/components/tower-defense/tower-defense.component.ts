import { Component, signal, OnDestroy, OnInit, HostListener, ChangeDetectionStrategy, ChangeDetectorRef, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TowerDefenseEngineService } from '../../services/tower-defense-engine.service';
import { TDTile } from '../../models/unit.model';
import { SettingsService } from '../../services/settings.service';
import { FirebaseService } from '../../services/firebase.service';
import { Subscription } from 'rxjs';
import { GameEngineService } from '../../services/game-engine.service';
import { SupportCommunityComponent } from '../support-community/support-community.component';

@Component({
    selector: 'app-tower-defense',
    standalone: true,
    imports: [CommonModule, SupportCommunityComponent],
    templateUrl: 'tower-defense.component.html',
    styleUrls: ['../../app.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
    :host {
      display: block;
      height: 100vh;
      background: #0f172a;
      color: white;
    }
    .td-grid {
      display: grid;
      grid-template-columns: repeat(10, 60px);
      grid-template-rows: repeat(10, 60px);
      gap: 2px;
      background: #1e293b;
      border: 4px solid #334155;
      border-radius: 8px;
      position: relative;
    }
    .td-tile {
      position: relative;
      width: 60px;
      height: 60px;
      transition: all 0.2s;
      overflow: hidden;
    }
    .tile-path { background: #475569; }
    .tile-buildable { 
      background: #1e293b; 
      cursor: pointer;
    }
    .tile-buildable:hover { background: #334155; }
    .tile-void { opacity: 0.1; }
    
    .range-indicator {
      position: absolute;
      background: rgba(56, 189, 248, 0.15);
      border: 2px solid rgba(56, 189, 248, 0.5);
      border-radius: 50%;
      pointer-events: none;
      z-index: 50;
      transform: translate(-50%, -50%);
      transition: all 0.2s ease-out;
    }

    .frost-aura-visual {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 248px; /* 4 клітинки * 62px */
  height: 248px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  pointer-events: none;
  z-index: 5;
  box-shadow: 0 0 15px rgba(0, 255, 255, 0.2);
}

    .enemy {
      position: absolute;
      width: 40px;
      height: 40px;
      background: #ef4444;
      border-radius: 50%;
      z-index: 10;
      box-shadow: 0 0 10px #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .enemy-fast {
      box-shadow: none;
    }
    
    .projectile {
      position: absolute;
      width: 6px;
      height: 6px;
      background: #fbbf24;
      border-radius: 50%;
      z-index: 20;
      box-shadow: 0 0 5px #fbbf24;
    }

    .shop-btn {
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
      font-weight: 700;
      transition: all 0.2s;
    }
    .shop-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .shape-preview {
      width: 18px;
      height: 18px;
      display: inline-block;
      background: rgba(255,255,255,0.2);
    }
    .shape-square { border-radius: 4px; }
    .shape-circle { border-radius: 50%; }
    .shape-triangle { clip-path: polygon(50% 0%, 0% 100%, 100% 100%); }
    .shape-hexagon { clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%); }
  `]
})
export class TowerDefenseComponent implements OnInit, OnDestroy, AfterViewInit {
    selectedTile = signal<TDTile | null>(null);
    mapLevel = signal(1);
    private uiSub?: Subscription;
    @ViewChild('gameCanvas', { static: false }) gameCanvas?: ElementRef<HTMLCanvasElement>;
    private ctx?: CanvasRenderingContext2D | null;
    private rafId: number | null = null;
    private readonly isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent) {
        if (this.tdEngine.isWaveInProgress()) { return; }

        const key = event.key;

        if (key === 'Enter') {
            event.preventDefault();
            this.tdEngine.startWave();
            return;
        }

    }
    @HostListener('window:keyup', ['$event'])
    onKeyUp(event: KeyboardEvent) { }

    constructor(
        public tdEngine: TowerDefenseEngineService,
        public settings: SettingsService,
        public gameEngine: GameEngineService,
        public firebase: FirebaseService,
        public router: Router,
        private cdr: ChangeDetectorRef,
    ) { }

    ngOnInit() {
        this.tdEngine.initializeGame(this.mapLevel());
        this.cdr.detectChanges();
        this.uiSub = this.tdEngine.uiTick$.subscribe(() => {
            this.cdr.detectChanges();
        });
    }

    ngAfterViewInit() {
        if (!this.isBrowser) return;
        setTimeout(() => {
            this.initCanvas();
            this.startCanvasLoop();
            setTimeout(() => this.resizeCanvas(), 100);
        }, 0);
        // requestAnimationFrame(() => {
        //     requestAnimationFrame(() => {
        //         this.initCanvas();
        //         this.drawFrame();
        //         this.gameReady.set(true);
        //         this.startCanvasLoop();
        //     });
        // });
        window.addEventListener('resize', this.resizeCanvas);
    }

    ngOnDestroy() {
        this.uiSub?.unsubscribe();
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
        if (this.isBrowser) {
            window.removeEventListener('resize', this.resizeCanvas);
        }
        this.tdEngine.resetEngine();
    }

    goBack() {
        this.tdEngine.resetEngine();
        this.router.navigate(['/']);
    }

    onRestart() {
        this.tdEngine.initializeGame(this.mapLevel());
        this.selectedTile.set(null);
    }

    onTileClick(tile: TDTile) {
        if (tile.type === 'buildable' || tile.tower) {
            this.selectedTile.set(tile);
        } else {
            this.selectedTile.set(null);
        }
    }

    buyTower(tier: number) {
        const tile = this.selectedTile();
        if (tile) {
            this.tdEngine.buyTower(tile.x, tile.y, tier);
            this.selectedTile.set(null);
        }
    }

    upgradeTower() {
        const tile = this.selectedTile();
        if (tile && tile.tower) {
            this.tdEngine.upgradeTower(tile.x, tile.y);
        }
    }

    getRangeStyle() {
        const tile = this.selectedTile();
        if (!tile || !tile.tower) return { display: 'none' };

        const tower = tile.tower;
        const tileSize = this.tdEngine.tileSize;
        const size = tower.range * 2 * tileSize;
        return {
            left: `${tower.position.x * tileSize + tileSize / 2}px`,
            top: `${tower.position.y * tileSize + tileSize / 2}px`,
            width: `${size}px`,
            height: `${size}px`,
            display: 'block'
        };
    }
    navigateToFeedback() {
        const user = this.firebase.user$();
        if (user) {
            this.router.navigate(['/feedback']);
            return;
        }
        try {
            this.firebase.loginWithGoogle();
        } catch { }
    }

    sellTower() {
        const tile = this.selectedTile();
        if (tile && tile.tower) {
            this.tdEngine.sellTower(tile.x, tile.y);
            this.selectedTile.set(null);
        }
    }

    setTowerStrategy(strategy: 'first' | 'weakest' | 'strongest' | 'random') {
        const tile = this.selectedTile();
        if (tile && tile.tower) {
            this.tdEngine.setTowerStrategy(tile.x, tile.y, strategy);
        }
    }

    buyAbility() {
        const tile = this.selectedTile();
        if (tile && tile.tower && tile.tower.level === 4 && !tile.tower.specialActive) {
            this.tdEngine.buyAbility(tile.x, tile.y);
        }
    }

    setSpeed(multiplier: number) {
        this.tdEngine.gameSpeedMultiplier.set(multiplier);
    }

    onMapSizeChange(level: number) {
        if (level === this.mapLevel()) return;
        this.mapLevel.set(level);
        this.tdEngine.initializeGame(level);
        this.selectedTile.set(null);
        if (this.isBrowser) {
            this.resizeCanvas();
        }
    }

    setHardMode(enabled: boolean) {
        if (this.tdEngine.isWaveInProgress()) return;
        this.tdEngine.isHardMode.set(enabled);
    }

    onLoginClick() {
        const user = this.firebase.user$();
        if (user) return;
        try {
            this.firebase.loginWithGoogle();
        } catch { }
    }

    private initCanvas = () => {
        const canvas = this.gameCanvas?.nativeElement;
        if (!canvas) return;
        this.ctx = canvas.getContext('2d');
        this.resizeCanvas();
    };

    private resizeCanvas = () => {
        const canvas = this.gameCanvas?.nativeElement;
        if (!canvas) return;
        const tile = this.tdEngine.tileSize;
        const gridSize = this.tdEngine.gridSize;

        if (!tile || !gridSize) return;

        const size = this.tdEngine.gridSize * tile;
        // Style size
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
        // Device pixel ratio scaling
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.ctx = ctx;
    };

    private startCanvasLoop() {
        const step = () => {
            this.drawFrame();
            this.rafId = requestAnimationFrame(step);
        };
        this.rafId = requestAnimationFrame(step);
    }

    private clearCanvas(ctx: CanvasRenderingContext2D, size: number) {
        ctx.clearRect(0, 0, size, size);
    }

    private drawFrame() {
        const canvas = this.gameCanvas?.nativeElement;
        const ctx = this.ctx;
        if (!canvas || !ctx) return;
        const tile = this.tdEngine.tileSize;
        const size = this.tdEngine.gridSize * tile;
        this.clearCanvas(ctx, size);
        this.drawGrid(ctx, tile);
        this.drawPathOverlay(ctx, tile);
        this.drawSelection(ctx, tile);
        this.drawFrostAuras(ctx, tile);
        this.drawTowers(ctx, tile);
        this.drawEnemies(ctx, tile);
        if (this.tdEngine.gameSpeedMultiplier() === 1) {
            this.drawProjectiles(ctx, tile);
        }
        this.drawRangeIndicator(ctx, tile);
    }

    private drawPathOverlay(ctx: CanvasRenderingContext2D, tile: number) {
        const path = this.tdEngine.getPathRef();
        if (!path || path.length < 2) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
            const p = path[i];
            const x = p.x * tile + tile / 2;
            const y = p.y * tile + tile / 2;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        const start = path[0];
        const end = path[path.length - 1];
        const sx = start.x * tile + tile / 2;
        const sy = start.y * tile + tile / 2;
        const ex = end.x * tile + tile / 2;
        const ey = end.y * tile + tile / 2;

        ctx.save();
        ctx.translate(sx, sy);
        const gateRadius = tile * 0.35;
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(56,189,248,0.95)';
        ctx.shadowColor = 'rgba(56,189,248,1)';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        const turns = 3;
        const totalAngle = Math.PI * 2 * turns;
        let first = true;
        for (let a = 0; a <= totalAngle; a += Math.PI / 32) {
            const t = a / totalAngle;
            const r = gateRadius * (0.4 + 0.6 * t);
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (first) {
                ctx.moveTo(x, y);
                first = false;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.translate(ex, ey);
        const shieldW = tile * 0.65;
        const shieldH = tile * 0.7;
        const hw = shieldW / 2;
        const hh = shieldH / 2;
        ctx.fillStyle = 'rgba(248,113,113,0.95)';
        ctx.strokeStyle = '#fecaca';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(248,113,113,0.9)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(0, -hh);
        ctx.lineTo(hw, -hh * 0.1);
        ctx.lineTo(hw * 0.8, hh);
        ctx.lineTo(-hw * 0.8, hh);
        ctx.lineTo(-hw, -hh * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.restore();
    }

    private drawGrid(ctx: CanvasRenderingContext2D, tile: number) {
        const grid = this.tdEngine.getGridRef();
        for (let y = 0; y < grid.length; y++) {
            const row = grid[y];
            for (let x = 0; x < row.length; x++) {
                const t = row[x];
                if (t.type === 'path') ctx.fillStyle = '#475569';
                else if (t.type === 'buildable') ctx.fillStyle = '#1e293b';
                else ctx.fillStyle = 'rgba(203, 23, 23, 0)';
                ctx.fillRect(x * tile, y * tile, tile - 2, tile - 2);
            }
        }
    }

    private drawTowers(ctx: CanvasRenderingContext2D, tile: number) {
        const towers = this.tdEngine.getTowersRef();
        const enemies = this.tdEngine.getEnemiesRef();
        const speed = this.tdEngine.gameSpeedMultiplier();
        for (const t of towers) {
            const cx = t.position.x * tile + tile / 2;
            const cy = t.position.y * tile + tile / 2;
            const padding = tile * 0.15;
            this.drawTowerShape(ctx, cx, cy, t.type, t.level, tile);

            if (t.specialActive) {
                ctx.save();
                ctx.fillStyle = '#00F2FF';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.font = `bold ${Math.floor(tile * 0.3)}px Arial`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText('★', cx - tile / 2 + padding, cy - tile / 2 + padding);
                ctx.restore();
            }
            if (t.specialActive && t.hasGolden) {
                ctx.save();
                ctx.fillStyle = '#FFD700';
                ctx.shadowColor = 'black';
                ctx.shadowBlur = 4;
                ctx.font = `bold ${Math.floor(tile * 0.3)}px Arial`;
                ctx.textAlign = 'right';
                ctx.textBaseline = 'top';
                ctx.fillText('⚡', cx + tile / 2 - padding, cy - tile / 2 + padding);
                ctx.restore();
            }

            if (speed === 1 && t.type === 6 && t.targetEnemyId) {
                const enemy = enemies.find(e => e.id === t.targetEnemyId);
                if (enemy) {
                    const ex = (enemy.displayX ?? (enemy.position.x + 0.5) * tile);
                    const ey = (enemy.displayY ?? (enemy.position.y + 0.5) * tile);
                    ctx.save();
                    let stroke: CanvasGradient | string = 'rgba(56,189,248,0.9)';
                    if (t.hasGolden) {
                        const grad = ctx.createLinearGradient(cx, cy, ex, ey);
                        grad.addColorStop(0, '#22c1c3');
                        grad.addColorStop(0.5, '#a855f7');
                        grad.addColorStop(1, '#f97316');
                        stroke = grad;
                    }
                    ctx.strokeStyle = stroke as CanvasGradient;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(ex, ey);
                    ctx.stroke();
                    ctx.restore();
                }
                if (t.extraTargetIds && t.extraTargetIds.length) {
                    for (const id of t.extraTargetIds) {
                        const enemy2 = enemies.find(e => e.id === id);
                        if (!enemy2) continue;
                        const ex2 = (enemy2.displayX ?? (enemy2.position.x + 0.5) * tile);
                        const ey2 = (enemy2.displayY ?? (enemy2.position.y + 0.5) * tile);
                        ctx.save();
                        let stroke2: CanvasGradient | string = 'rgba(56,189,248,0.7)';
                        if (t.hasGolden) {
                            const grad2 = ctx.createLinearGradient(cx, cy, ex2, ey2);
                            grad2.addColorStop(0, '#22c1c3');
                            grad2.addColorStop(0.5, '#a855f7');
                            grad2.addColorStop(1, '#f97316');
                            stroke2 = grad2;
                        }
                        ctx.strokeStyle = stroke2 as CanvasGradient;
                        ctx.lineWidth = 1.5;
                        ctx.beginPath();
                        ctx.moveTo(cx, cy);
                        ctx.lineTo(ex2, ey2);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        }
    }

    private drawTowerShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, type: number, level: number, tile: number) {
        const baseSize = tile * 0.5;
        const half = baseSize / 2;
        const color =
            type === 1 ? '#0ea5e9' :
                type === 2 ? '#a855f7' :
                    type === 3 ? '#f59e0b' :
                        type === 4 ? '#ef4444' :
                            type === 5 ? '#fb923c' :
                                type === 6 ? '#22d3ee' :
                                    '#84cc16';

        const lineWidth = 2.5;
        const lv = Math.max(1, Math.min(4, level || 1));

        ctx.save();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;

        if (lv >= 4) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 16;
        }
        ctx.beginPath();
        if (type === 1) {
            const r = baseSize * 0.5;
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
        } else if (type === 2) {
            const h = baseSize * 0.9;
            const w = baseSize * 0.9;
            ctx.moveTo(cx, cy - h / 2);
            ctx.lineTo(cx - w / 2, cy + h / 2);
            ctx.lineTo(cx + w / 2, cy + h / 2);
            ctx.closePath();
        } else if (type === 3) {
            ctx.rect(cx - half, cy - half, baseSize, baseSize);
        } else if (type === 4) {
            const h = baseSize * 0.9;
            const w = baseSize * 0.9;
            ctx.moveTo(cx, cy - h / 2);
            ctx.lineTo(cx + w / 2, cy);
            ctx.lineTo(cx, cy + h / 2);
            ctx.lineTo(cx - w / 2, cy);
            ctx.closePath();
        } else if (type === 5) {
            const r = baseSize * 0.5;
            for (let i = 0; i < 5; i++) {
                const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        } else if (type === 6) {
            const r = baseSize * 0.5;
            for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i - Math.PI / 2;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
        } else if (type === 7) {
            const r = baseSize * 0.5;
            const thickness = 0.35;
            ctx.moveTo(cx - r * thickness, cy - r);
            ctx.lineTo(cx + r * thickness, cy - r);
            ctx.lineTo(cx + r * thickness, cy - r * thickness);
            ctx.lineTo(cx + r, cy - r * thickness);
            ctx.lineTo(cx + r, cy + r * thickness);
            ctx.lineTo(cx + r * thickness, cy + r * thickness);
            ctx.lineTo(cx + r * thickness, cy + r);
            ctx.lineTo(cx - r * thickness, cy + r);
            ctx.lineTo(cx - r * thickness, cy + r * thickness);
            ctx.lineTo(cx - r, cy + r * thickness);
            ctx.lineTo(cx - r, cy - r * thickness);
            ctx.lineTo(cx - r * thickness, cy - r * thickness);
            ctx.closePath();
        }

        if (lv >= 2) {
            ctx.fillStyle = color;
            ctx.globalAlpha = lv === 2 ? 0.7 : 0.9;
            ctx.fill();
            ctx.globalAlpha = 1;
        }

        ctx.stroke();

        if (lv >= 3) {
            ctx.beginPath();
            const innerR = baseSize * 0.18;
            ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
            ctx.fillStyle = '#0f172a';
            ctx.fill();
        }

        if (lv >= 4) {
            ctx.beginPath();
            const outerR = baseSize * 0.75;
            ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = color;
            ctx.globalAlpha = 0.5;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        ctx.restore();
    }

    private drawFrostAuras(ctx: CanvasRenderingContext2D, tile: number) {
        const towers = this.tdEngine.getTowersRef();
        for (const t of towers) {
            if (t.type === 1 && t.specialActive) {
                const cx = t.position.x * tile + tile / 2;
                const cy = t.position.y * tile + tile / 2;
                const radius = 2 * tile;
                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(56, 189, 248, 0.05)';
                ctx.fill();
                ctx.lineWidth = 1
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)';
                ctx.stroke();
            }
        }
    }

    private drawEnemies(ctx: CanvasRenderingContext2D, tile: number) {
        const enemies = this.tdEngine.getEnemiesRef();
        const isFastSpeed = this.tdEngine.gameSpeedMultiplier() > 1;

        for (const e of enemies) {
            const scale = e.scale ?? 1;
            const size = scale * (tile * 0.65);
            const r = size / 2;
            const cx = e.displayX ?? ((e.position.x + 0.5) * tile);
            const cy = e.displayY ?? ((e.position.y + 0.5) * tile);
            ctx.fillStyle = e.bg || (e.isFrozen ? '#7dd3fc' : '#ef4444');
            let strokeColor = 'transparent';
            let shadowColor = isFastSpeed ? 'transparent' : ctx.fillStyle;
            let shadowBlur = isFastSpeed ? 0 : 10;
            let lineWidth = 2;

            if (e.isMagma) {
                strokeColor = '#f97316';
                shadowColor = '#f97316';
                shadowBlur = isFastSpeed ? 0 : 15;
                lineWidth = 3;
            } else if (e.isMirror) {
                strokeColor = '#f0f9ff';
                shadowColor = '#0ea5e9';
                shadowBlur = isFastSpeed ? 0 : 15;
                lineWidth = 3;
            } else if (e.isSlime) {
                strokeColor = '#22c55e';
                shadowColor = '#22c55e';
                shadowBlur = isFastSpeed ? 0 : 15;
                lineWidth = 3;
            }

            ctx.shadowColor = shadowColor;
            ctx.shadowBlur = shadowBlur;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = lineWidth;
            ctx.beginPath();
            if (e.type === 'tank') {
                ctx.arc(cx, cy, r, 0, Math.PI * 2);
            } else if (e.type === 'scout') {
                ctx.moveTo(cx, cy - r);
                ctx.lineTo(cx - r, cy + r);
                ctx.lineTo(cx + r, cy + r);
                ctx.closePath();
            } else if (e.type === 'boss') {
                const points = 6;
                for (let i = 0; i < points; i++) {
                    const angle = (Math.PI * 2 * i) / points - Math.PI / 2;
                    const px = cx + r * Math.cos(angle);
                    const py = cy + r * Math.sin(angle);
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath();
            } else {
                ctx.rect(cx - r, cy - r, size, size);
            }
            ctx.fill();
            if (strokeColor !== 'transparent') {
                ctx.stroke();
            }
            ctx.shadowBlur = 0;
        }
        for (const e of enemies) {
            const size = (e.isBoss ? 1.5 : 1) * (tile * 0.65);
            const r = size / 2;
            const cx = e.displayX ?? ((e.position.x + 0.5) * tile);
            const cy = e.displayY ?? ((e.position.y + 0.5) * tile);
            const barW = size;
            const barH = 4;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(cx - r, cy - r - 10, barW, barH);
            ctx.fillStyle = '#10b981';
            const pct = Math.max(0, Math.min(1, e.hp / e.maxHp));
            ctx.fillRect(cx - r, cy - r - 10, barW * pct, barH);
        }
    }

    private drawSelection(ctx: CanvasRenderingContext2D, tile: number) {
        const tileSel = this.selectedTile();
        if (!tileSel) return;
        const x = tileSel.x * tile;
        const y = tileSel.y * tile;
        ctx.save();
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
        ctx.shadowColor = 'rgba(56, 189, 248, 0.9)';
        ctx.shadowBlur = 14;
        ctx.strokeRect(x + 1.5, y + 1.5, tile - 3, tile - 3);
        ctx.restore();
    }

    private drawProjectiles(ctx: CanvasRenderingContext2D, tile: number) {
        const speed = this.tdEngine.gameSpeedMultiplier();
        if (speed >= 2) return;
        const projs = this.tdEngine.getProjectilesRef();
        ctx.fillStyle = '#fbbf24';
        for (const p of projs) {
            const x = p.from.x + (p.to.x - p.from.x) * p.progress;
            const y = p.from.y + (p.to.y - p.from.y) * p.progress;
            ctx.beginPath();
            ctx.arc(x * tile + tile / 2, y * tile + tile / 2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        const zones = this.tdEngine.getInfernoZonesRef();
        for (const z of zones) {
            if (z.dps <= 0) continue;
            const cx = z.position.x * tile + tile / 2;
            const cy = z.position.y * tile + tile / 2;
            const r = z.radius * tile;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(248, 113, 113, 0.15)';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(248, 113, 113, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.restore();
        }
    }

    private drawRangeIndicator(ctx: CanvasRenderingContext2D, tile: number) {
        const tileSel = this.selectedTile();
        if (!tileSel || !tileSel.tower) return;
        const t = tileSel.tower;
        const cx = t.position.x * tile + tile / 2;
        const cy = t.position.y * tile + tile / 2;
        const radius = t.range * tile;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.stroke();
    }

    onCanvasClick(evt: MouseEvent) {
        const canvas = this.gameCanvas?.nativeElement;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const xCss = evt.clientX - rect.left;
        const yCss = evt.clientY - rect.top;
        const tile = this.tdEngine.tileSize;
        const gx = Math.floor(xCss / tile);
        const gy = Math.floor(yCss / tile);
        const grid = this.tdEngine.getGridRef();
        if (gy >= 0 && gy < grid.length && gx >= 0 && gx < grid[0].length) {
            this.onTileClick(grid[gy][gx]);
        }
    }
}
