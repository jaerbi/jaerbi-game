import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService, ScoreEntry } from '../../services/firebase.service';
import { GameEngineService } from '../../services/game-engine.service';
import { PlayerNameService } from '../../services/player-name.service';
import { MapSize, SettingsService, Difficulty } from '../../services/settings.service';

@Component({
    selector: 'app-leaderboard-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[720px] max-w-[95vw] mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-white">Leaderboard</h2>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-lg cursor-pointer"
            (click)="gameEngine.closeLeaderboard()"
          >
            ✖
          </button>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-700 mb-4">
          <button 
            (click)="activeTab.set('top10')"
            [class.text-white]="activeTab() === 'top10'"
            [class.border-b-2]="activeTab() === 'top10'"
            [class.border-indigo-500]="activeTab() === 'top10'"
            class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            Top 10
          </button>
          <button 
            *ngIf="firebase.user$()"
            (click)="switchToMyStats()"
            [class.text-white]="activeTab() === 'mystats'"
            [class.border-b-2]="activeTab() === 'mystats'"
            [class.border-indigo-500]="activeTab() === 'mystats'"
            class="px-4 py-2 text-sm font-medium text-gray-400 hover:text-gray-200 transition-colors"
          >
            My Statistics
          </button>
        </div>

        <div *ngIf="activeTab() === 'top10'">
          <div class="text-sm text-gray-300 mb-3 flex items-center gap-2">
            <span>Top 10 scores for:</span>
            <span class="px-2 py-0.5 rounded bg-indigo-900 text-indigo-100 font-semibold border border-indigo-700">
               {{ settings.difficultyLabel() }}
            </span>
            <span class="px-2 py-0.5 rounded bg-emerald-900 text-emerald-100 font-semibold border border-emerald-700">
               {{ settings.mapSizeLabel() }}
            </span>
          </div>

          <div class="min-h-24 flex items-center justify-center" *ngIf="loading()">
            <span class="inline-flex items-center gap-2 text-gray-300">
              <span class="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></span>
              <span>Loading...</span>
            </span>
          </div>

          <div *ngIf="!loading()">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-gray-300">
                  <th class="text-left py-2 px-2 border-b border-gray-700">Rank</th>
                  <th class="text-left py-2 px-2 border-b border-gray-700">Name</th>
                  <th class="text-left py-2 px-2 border-b border-gray-700">Victory Type</th>
                  <th class="text-left py-2 px-2 border-b border-gray-700">Turns</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  *ngFor="let s of scores(); let i = index"
                  [class.bg-indigo-900/40]="isCurrentPlayer(s)"
                  [class.border]="isCurrentPlayer(s)"
                  [class.border-indigo-500]="isCurrentPlayer(s)"
                  class="text-white"
                >
                  <td class="py-2 px-2 border-b border-gray-800">{{ i + 1 }}</td>
                  <td class="py-2 px-2 border-b border-gray-800 flex items-center gap-2">
                    <img *ngIf="s.userPhoto; else noPhoto" referrerpolicy="no-referrer" [src]="s.userPhoto" class="w-6 h-6 rounded-full border border-gray-600">
                    <ng-template #noPhoto>
                      <div class="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400 border border-gray-600">👤</div>
                    </ng-template>
                    {{ s.playerName }}
                  </td>
                  <td class="py-2 px-2 border-b border-gray-800">{{ s.victoryType }}</td>
                  <td class="py-2 px-2 border-b border-gray-800 font-mono text-yellow-300">{{ s.turnsPlayed }}</td>
                </tr>
                <tr *ngIf="scores().length === 0">
                  <td colspan="4" class="py-8 text-center text-gray-400 italic">
                    No scores found for {{ settings.difficultyLabel() }} / {{ settings.mapSizeLabel() }} yet.
                    <br/>
                    <span class="text-xs opacity-75">Be the first to claim victory!</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div *ngIf="activeTab() === 'mystats'" class="text-white">
           <div class="min-h-24 flex items-center justify-center" *ngIf="loading()">
            <span class="inline-flex items-center gap-2 text-gray-300">
              <span class="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></span>
              <span>Loading your stats...</span>
            </span>
          </div>

          <div *ngIf="!loading()" class="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div *ngIf="myBestScores().length === 0" class="col-span-2 text-center py-8 text-gray-400">
               No victories recorded yet. keep playing!
             </div>

             <div *ngFor="let stat of myBestScores()" class="bg-gray-800/50 p-4 rounded border border-gray-700">
                <div class="flex justify-between items-start mb-2">
                  <span class="px-2 py-0.5 rounded bg-indigo-900 text-indigo-100 text-xs font-semibold border border-indigo-700 uppercase tracking-wide">
                    {{ stat.difficulty }}
                  </span>
                  <span class="px-2 py-0.5 rounded bg-emerald-900 text-emerald-100 text-xs font-semibold border border-emerald-700">
                    {{ stat.mapSize }}
                  </span>
                </div>
                <div class="flex justify-between items-end">
                  <span class="text-gray-400 text-sm">Best Performance</span>
                  <span class="text-xl font-mono text-yellow-300">{{ stat.turnsPlayed }} Turns</span>
                </div>
                <div class="mt-1 text-xs text-gray-500">
                  {{ stat.victoryType }} • {{ stat.timestamp | date:'mediumDate' }}
                </div>
             </div>
          </div>
        </div>

      </div>
    </div>
  `
})
export class LeaderboardModalComponent {
    loading = signal<boolean>(true);
    scores = signal<ScoreEntry[]>([]);
    activeTab = signal<'top10' | 'mystats'>('top10');
    myBestScores = signal<ScoreEntry[]>([]);

    constructor(
        public firebase: FirebaseService,
        public gameEngine: GameEngineService,
        private playerName: PlayerNameService,
        public settings: SettingsService
    ) {
        this.fetch();
    }

    async fetch() {
        this.loading.set(true);
        try {
            const diff = this.settings.difficulty();
            const size = this.settings.mapSize() as MapSize;
            const list = await this.firebase.getTopScores(10, diff, size);
            this.scores.set(list ?? []);
        } catch {
            this.scores.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    async switchToMyStats() {
        this.activeTab.set('mystats');
        this.loading.set(true);
        const user = this.firebase.user$();
        if (!user) {
            this.myBestScores.set([]);
            this.loading.set(false);
            return;
        }

        try {
            const allMyScores = await this.firebase.getUserScores(user.uid);
            // Group by difficulty + mapSize and find best
            const bestMap = new Map<string, ScoreEntry>();

            allMyScores.forEach(s => {
                const key = `${s.difficulty}-${s.mapSize}`;
                if (!bestMap.has(key) || s.turnsPlayed < bestMap.get(key)!.turnsPlayed) {
                    bestMap.set(key, s);
                }
            });

            this.myBestScores.set(Array.from(bestMap.values()).sort((a, b) => {
                 // Sort by difficulty hard to easy, then size
                const diffOrder: Record<string, number> = { 'baby': 0, 'normal': 1, 'hard': 2, 'nightmare': 3 };
                const diffDiff = diffOrder[b.difficulty] - diffOrder[a.difficulty];

                if (diffDiff !== 0) return diffDiff;

                return a.mapSize - b.mapSize;
            }));

        } catch (e) {
            console.error(e);
            this.myBestScores.set([]);
        } finally {
            this.loading.set(false);
        }
    }

    isCurrentPlayer(entry: ScoreEntry): boolean {
        return (entry?.playerName ?? '') === this.playerName.name();
    }
}
