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
      <div class="w-full max-w-3xl bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-6">
          <a routerLink="/tower-defense" class="cursor-pointer px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-bold transition-colors">{{ settings.t('RETURN_TO_MAP') }}</a>
        <div class="flex items-center justify-between mb-4 mt-4">
          <h1 class="text-2xl font-black tracking-wide">Tower Defense Leaderboard</h1>
        </div>

        <div class="mb-4 text-sm text-slate-300">
          Top 10 runs ranked by highest wave reached.
        </div>

        <div class="min-h-[80px] flex items-center justify-center" *ngIf="loading()">
          <span class="inline-flex items-center gap-2 text-slate-300">
            <span class="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></span>
            <span>Loading leaderboard...</span>
          </span>
        </div>

        <div *ngIf="!loading()">
          <div class="mb-4 inline-flex rounded-full bg-slate-900/70 p-1 border border-slate-700">
            <button
              class="px-4 py-1 text-xs font-semibold rounded-full transition-colors"
              [class.bg-sky-500]="selectedMapSize() === 10"
              [class.text-slate-900]="selectedMapSize() === 10"
              [class.text-slate-300]="selectedMapSize() !== 10"
              (click)="selectMapSize(10)"
            >
              Map 10x10
            </button>
            <button
              class="px-4 py-1 text-xs font-semibold rounded-full transition-colors"
              [class.bg-sky-500]="selectedMapSize() === 20"
              [class.text-slate-900]="selectedMapSize() === 20"
              [class.text-slate-300]="selectedMapSize() !== 20"
              (click)="selectMapSize(20)"
            >
              Map 20x20
            </button>
          </div>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-300">
                <th class="text-left py-2 px-2 border-b border-slate-700">Rank</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Name</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Wave</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Map</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Mastery XP</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of scores(); let i = index" class="text-white">
                <td class="py-2 px-2 border-b border-slate-800 font-mono text-sky-300">{{ i + 1 }}</td>
                <td class="py-2 px-2 border-b border-slate-800">
                  {{ s.displayName || 'Anonymous' }}
                </td>
                <td class="py-2 px-2 border-b border-slate-800 font-mono text-emerald-400">
                  {{ s.maxWave }}
                </td>
                <td class="py-2 px-2 border-b border-slate-800 font-mono text-sky-300">
                  {{ s.mapSize || '10x10' }}
                </td>
                <td class="py-2 px-2 border-b border-slate-800 font-mono text-sky-300">
                  {{ s.userTotalXp ?? 0 }}
                </td>
                <td class="py-2 px-2 border-b border-slate-800 text-slate-300">
                  {{ s.timestamp?.toDate ? (s.timestamp.toDate() | date:'mediumDate') : (s.timestamp | date:'mediumDate') }}
                </td>
              </tr>
              <tr *ngIf="scores().length === 0">
                <td colspan="6" class="py-8 text-center text-slate-400 italic">
                  No runs recorded yet. Finish a game while logged in to appear here.
                </td>
              </tr>
            </tbody>
          </table>
          <div *ngIf="best() as b" class="mt-6 pt-4 border-t border-slate-700">
            <div class="text-xs font-semibold text-slate-400 mb-2">
              Your Personal Best
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
                  <td class="py-2 px-2 border-b border-slate-800 font-mono text-sky-300">
                    {{ b.mapSize || '10x10' }}
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800 font-mono text-sky-300">
                    {{ b.userTotalXp ?? 0 }}
                  </td>
                  <td class="py-2 px-2 border-b border-slate-800 text-slate-300">
                    {{ b.timestamp?.toDate ? (b.timestamp.toDate() | date:'mediumDate') : (b.timestamp | date:'mediumDate') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class TowerDefenseLeaderboardComponent implements OnInit {
    loading = signal<boolean>(true);
    scores = signal<TowerDefenseScore[]>([]);
    best = signal<TowerDefenseScore | null>(null);
    selectedMapSize = signal<10 | 20>(10);
    displayScores = computed(() => this.scores());

    constructor(private firebase: FirebaseService, public settings: SettingsService) { }

    ngOnInit() {
        const currentSize = this.settings.mapSize();
        if (currentSize === 20) {
            this.selectedMapSize.set(20);
        } else {
            this.selectedMapSize.set(10);
        }
        this.loadScores();
    }

    async loadScores() {
        this.loading.set(true);
        const size = this.selectedMapSize();
        try {
            const list = await this.firebase.getTopTowerDefenseScores(10, size);
            this.scores.set(list ?? []);
            await this.loadPersonalBest(size);
        } catch {
            this.scores.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    private async loadPersonalBest(size: number) {
        const user = this.firebase.user$();

        if (!user) return;

        const entry = await this.firebase.getUserBestTowerDefenseScore(user.uid, size);
        this.best.set(entry ?? null);
    }

    selectMapSize(size: 10 | 20) {
        if (this.selectedMapSize() === size) return;

        this.selectedMapSize.set(size);
        this.loadScores();
    }
}
