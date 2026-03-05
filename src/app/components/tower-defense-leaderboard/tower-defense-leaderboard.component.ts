import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService, TowerDefenseScore } from '../../services/firebase.service';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-tower-defense-leaderboard',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
    <div class="min-h-screen bg-slate-900 text-white flex flex-col items-center py-10 px-4">
      <div class="w-full max-w-4xl bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-6">
        <a routerLink="/tower-defense" class="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold transition-colors">{{ settings.t('RETURN_TO_MAP') }}</a>
        
        <div class="flex items-center justify-between mb-4 mt-4">
          <h1 class="text-2xl font-black tracking-wide">
            {{ selectedMapSize() === 30 ? 'Campaign Champions' : 'Tower Defense Leaderboard' }}
          </h1>
        </div>

        <div class="mb-4 text-sm text-slate-300">
          {{ selectedMapSize() === 30 ? 'Ranked by missions completed and total lives saved.' : 'Top 10 runs ranked by highest wave reached.' }}
        </div>

        <div class="mb-6 flex flex-wrap gap-2">
          <div class="inline-flex rounded-full bg-slate-900/70 p-1 border border-slate-700">
            <button
              class="px-4 py-1 text-xs font-semibold rounded-full transition-colors"
              [class.bg-sky-500]="selectedMapSize() === 10"
              [class.text-slate-900]="selectedMapSize() === 10"
              [class.text-slate-300]="selectedMapSize() !== 10"
              (click)="selectMapSize(10)"
            >Top 10 (10x10)</button>
            <button
              class="px-4 py-1 text-xs font-semibold rounded-full transition-colors"
              [class.bg-sky-500]="selectedMapSize() === 20"
              [class.text-slate-900]="selectedMapSize() === 20"
              [class.text-slate-300]="selectedMapSize() !== 20"
              (click)="selectMapSize(20)"
            >Top 10 (20x20)</button>
          </div>

          <div class="inline-flex rounded-full bg-amber-900/30 p-1 border border-amber-700/50">
            <button
              class="px-4 py-1 text-xs font-semibold rounded-full transition-colors"
              [class.bg-amber-500]="selectedMapSize() === 30"
              [class.text-slate-900]="selectedMapSize() === 30"
              [class.text-amber-200]="selectedMapSize() !== 30"
              (click)="selectMapSize(30)"
            >🏆 Campaign Top</button>
          </div>

          <button
            class="px-4 py-1 text-xs font-semibold rounded-full border border-slate-700 transition-colors"
            [class.bg-slate-600]="selectedMapSize() === 0"
            (click)="selectMapSize(0)"
          >My Records</button>
        </div>

        <div class="min-h-[200px] flex items-center justify-center" *ngIf="loading()">
            <span class="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></span>
        </div>

        <div *ngIf="!loading()">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-400 uppercase text-[10px] tracking-widest">
                <th class="text-left py-3 px-2 border-b border-slate-700">Rank</th>
                <th class="text-left py-3 px-2 border-b border-slate-700">Player</th>
                
                <ng-container *ngIf="selectedMapSize() !== 30">
                  <th class="text-left py-3 px-2 border-b border-slate-700">Wave</th>
                  <th class="text-left py-3 px-2 border-b border-slate-700">Map</th>
                </ng-container>

                <ng-container *ngIf="selectedMapSize() === 30">
                  <th class="text-left py-3 px-2 border-b border-slate-700 text-emerald-400">Missions</th>
                  <th class="text-left py-3 px-2 border-b border-slate-700 text-amber-400">Total Lives</th>
                </ng-container>

                <th class="text-left py-3 px-2 border-b border-slate-700">Mastery XP</th>
                <th class="text-right py-3 px-2 border-b border-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of scores(); let i = index" class="text-white hover:bg-white/5 transition-colors">
                <td class="py-3 px-2 border-b border-slate-800 font-mono text-sky-400">#{{ i + 1 }}</td>
                <td class="py-3 px-2 border-b border-slate-800 font-bold">
                  {{ s.displayName || 'Anonymous' }}
                </td>
                
                <ng-container *ngIf="selectedMapSize() !== 30">
                  <td class="py-3 px-2 border-b border-slate-800 font-mono text-emerald-400">{{ s.maxWave }}</td>
                  <td class="py-3 px-2 border-b border-slate-800 text-slate-400 text-xs">{{ s.mapSize || '10x10' }}</td>
                </ng-container>

                <ng-container *ngIf="selectedMapSize() === 30">
                  <td class="py-3 px-2 border-b border-slate-800 font-mono text-emerald-400 text-base">
                    {{ s.completedLevelsCount || 0 }}
                  </td>
                  <td class="py-3 px-2 border-b border-slate-800 font-mono text-amber-400 text-base">
                    {{ s.totalLivesSum || 0 }}
                  </td>
                </ng-container>

                <td class="py-3 px-2 border-b border-slate-800 font-mono text-sky-300">{{ s.totalXp ?? s.userTotalXp ?? 0 }}</td>
                <td class="py-3 px-2 border-b border-slate-800 text-slate-500 text-right text-xs">
                  {{ formatDate(s.timestamp || s.lastActivityAt) }}
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="selectedMapSize() !== 0 && best() as b" class="mt-6 pt-4 border-t border-slate-700">
            <div class="text-xs font-semibold text-slate-400 mb-2">
              Your Personal Best ({{selectedMapSize()}}x{{selectedMapSize()}})
            </div>
            <table class="w-full text-sm">
              <tbody>
                <tr class="text-white">
                  <td class="py-2 px-2 border-b border-slate-800 font-mono text-amber-300">
                    Your Best
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800">
                    {{ b.displayName || 'You' }}
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800 font-mono text-emerald-400">
                    {{ b.maxWave }}
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800 text-slate-400 font-mono">
                    {{ b.mapSize || '10x10' }}
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800 font-mono text-sky-300">
                    {{ b.userTotalXp ?? 0 }}
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800 text-slate-400">
                     {{ formatDate(b.timestamp) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div *ngIf="scores().length === 0" class="py-12 text-center text-slate-500 italic">
            No heroes found in this category yet.
          </div>
        </div>
      </div>
    </div>
  `
})
export class TowerDefenseLeaderboardComponent implements OnInit {
    loading = signal<boolean>(true);
    scores = signal<any[]>([]);
    best = signal<TowerDefenseScore | null>(null);
    selectedMapSize = signal<10 | 20 | 30 | 0>(10); // 30 = Campaign

    constructor(private firebase: FirebaseService, public settings: SettingsService) { }

    ngOnInit() {
        this.loadScores();
    }

    async loadScores() {
        this.loading.set(true);
        const size = this.selectedMapSize();

        try {
            if (size === 30) {
                const list = await this.firebase.getCampaignLeaderboard(10);
                this.scores.set(list || []);
                this.best.set(null);
            } else if (size === 0) {
                const user = this.firebase.user$();
                if (user) {
                    const list = await this.firebase.getMyTowerDefenseHistory(user.uid, 10);
                    this.scores.set(list ?? []);
                }
                this.best.set(null);
            } else {
                const list = await this.firebase.getTopTowerDefenseScores(10, size as 10 | 20);
                this.scores.set(list ?? []);
                await this.loadPersonalBest(size as 10 | 20);
            }
        } catch (e) {
            console.error(e);
            this.scores.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private async loadPersonalBest(size: 10 | 20) {
        const user = this.firebase.user$();
        if (!user) return;
        const entry = await this.firebase.getUserBestTowerDefenseScore(user.uid, size);
        this.best.set(entry ?? null);
    }

    selectMapSize(size: 10 | 20 | 30 | 0) {
        if (this.selectedMapSize() === size) return;
        this.selectedMapSize.set(size);
        this.loadScores();
    }

    formatDate(ts: any) {
        if (!ts) return '---';
        const date = ts.toDate ? ts.toDate() : new Date(ts);
        return date.toLocaleDateString();
    }
}
