import { Component, OnInit, signal } from '@angular/core';
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
          <table class="w-full text-sm">
            <thead>
              <tr class="text-slate-300">
                <th class="text-left py-2 px-2 border-b border-slate-700">Rank</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Name</th>
                <th class="text-left py-2 px-2 border-b border-slate-700">Wave</th>
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
                  {{ s.userTotalXp ?? 0 }}
                </td>
                <td class="py-2 px-2 border-b border-slate-800 text-slate-300">
                  {{ s.timestamp?.toDate ? (s.timestamp.toDate() | date:'mediumDate') : (s.timestamp | date:'mediumDate') }}
                </td>
              </tr>
              <tr *ngIf="scores().length === 0">
                <td colspan="5" class="py-8 text-center text-slate-400 italic">
                  No runs recorded yet. Finish a game while logged in to appear here.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class TowerDefenseLeaderboardComponent implements OnInit {
    loading = signal<boolean>(true);
    scores = signal<TowerDefenseScore[]>([]);

    constructor(private firebase: FirebaseService,
        public settings: SettingsService,
    ) { }

    ngOnInit() {
        this.loadScores();
    }

    async loadScores() {
        this.loading.set(true);
        try {
            const list = await this.firebase.getTopTowerDefenseScores(10);
            this.scores.set(list ?? []);
        } catch {
            this.scores.set([]);
        } finally {
            this.loading.set(false);
        }
    }
}
