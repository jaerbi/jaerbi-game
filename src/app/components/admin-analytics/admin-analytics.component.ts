import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebase.service';
import { RouterLink } from '@angular/router';
import { WaveAnalyticsService } from '../../services/wave-analytics.service';

interface TowerStats {
  type: number;
  name: string;
  pickCount: number;
  totalDamagePercent: number;
  totalRawDamage: number;
  totalTier: number;
  avgDamagePercent: number;
  avgRawDamage: number;
  avgTier: number;
  pickRate: number;
  verdict: 'OP' | 'Weak' | 'Balanced';
}

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div class="max-w-7xl mx-auto">
        <header class="flex justify-between items-center mb-8">
          <div>
            <h1 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
              ADMIN ANALYTICS
            </h1>
            <p class="text-slate-500 text-sm mt-1">Game Version: {{ currentVersion() }}</p>
          </div>
          <a routerLink="/" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold transition-colors">
            Exit
          </a>
        </header>

        <!-- Filters / Controls -->
        <div class="bg-slate-900/50 border border-slate-800 rounded-xl p-4 mb-8 flex gap-4 items-center">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-slate-500 uppercase">Version</span>
            <select 
              [value]="currentVersion()" 
              (change)="setVersion($any($event.target).value)"
              class="bg-slate-950 border border-slate-700 rounded px-3 py-1 text-sm focus:outline-none focus:border-sky-500"
            >
              <option value="0.0.1">0.0.1</option>
              <option value="0.0.2">0.0.2</option>
            </select>
          </div>
          
          <button 
            (click)="loadData()" 
            class="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded transition-colors ml-auto"
            [disabled]="loading()"
          >
            {{ loading() ? 'Loading...' : 'Refresh Data' }}
          </button>
        </div>

        <!-- Main Matrix -->
        <div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-950 text-xs uppercase tracking-wider text-slate-500 font-bold border-b border-slate-800">
                  <th class="p-4 w-16 text-center">ID</th>
                  <th class="p-4">Tower Name</th>
                  <th class="p-4 text-right cursor-pointer hover:text-sky-400" (click)="setSort('pickRate')">
                    Pick Rate {{ getSortIcon('pickRate') }}
                  </th>
                  <th class="p-4 text-right cursor-pointer hover:text-sky-400" (click)="setSort('avgDamagePercent')">
                    Avg Dmg % {{ getSortIcon('avgDamagePercent') }}
                  </th>
                  <th class="p-4 text-right cursor-pointer hover:text-sky-400" (click)="setSort('avgRawDamage')">
                    Raw DPS {{ getSortIcon('avgRawDamage') }}
                  </th>
                  <th class="p-4 text-right">Avg Tier</th>
                  <th class="p-4 text-center">Verdict</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                <tr *ngFor="let stat of sortedStats()" class="hover:bg-slate-800/30 transition-colors">
                  <td class="p-4 text-center font-mono text-slate-600">{{ stat.type }}</td>
                  <td class="p-4 font-bold text-slate-300 flex items-center gap-3">
                    <span class="text-xl">{{ getTowerIcon(stat.type) }}</span>
                    {{ stat.name }}
                  </td>
                  <td class="p-4 text-right">
                    <div class="flex flex-col items-end">
                      <span [class]="getScaleColor(stat.pickRate, 0.7, 0.1)">
                        {{ (stat.pickRate * 100) | number:'1.1-1' }}%
                      </span>
                      <span class="text-[10px] text-slate-600">{{ stat.pickCount }} games</span>
                    </div>
                  </td>
                  <td class="p-4 text-right">
                    <span [class]="getScaleColor(stat.avgDamagePercent, 30, 5)">
                      {{ stat.avgDamagePercent | number:'1.1-1' }}%
                    </span>
                  </td>
                  <td class="p-4 text-right font-mono text-slate-400 text-sm">
                    {{ stat.avgRawDamage | number:'1.0-0' }}
                  </td>
                  <td class="p-4 text-right text-slate-500">
                    {{ stat.avgTier | number:'1.1-1' }}
                  </td>
                  <td class="p-4 text-center">
                    <span 
                      class="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border"
                      [ngClass]="{
                        'bg-red-500/10 text-red-400 border-red-500/20': stat.verdict === 'OP',
                        'bg-amber-500/10 text-amber-400 border-amber-500/20': stat.verdict === 'Weak',
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20': stat.verdict === 'Balanced'
                      }"
                    >
                      {{ stat.verdict }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div *ngIf="stats().length === 0 && !loading()" class="p-12 text-center text-slate-500">
            No data found for version {{ currentVersion() }}
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminAnalyticsComponent implements OnInit {
  currentVersion = signal('0.0.2');
  loading = signal(false);
  stats = signal<TowerStats[]>([]);
  sortField = signal<keyof TowerStats>('pickRate');
  sortDesc = signal(true);

  sortedStats = computed(() => {
    const s = [...this.stats()];
    const field = this.sortField();
    const desc = this.sortDesc();
    
    return s.sort((a, b) => {
      const valA = a[field];
      const valB = b[field];
      if (typeof valA === 'number' && typeof valB === 'number') {
        return desc ? valB - valA : valA - valB;
      }
      return 0;
    });
  });

  constructor(private firebase: FirebaseService, private _waveAnalyticsService: WaveAnalyticsService) {}

  ngOnInit() {
    this.loadData();
  }

  setVersion(v: string) {
    this.currentVersion.set(v);
    this.loadData();
  }

  setSort(field: keyof TowerStats) {
    if (this.sortField() === field) {
      this.sortDesc.update(d => !d);
    } else {
      this.sortField.set(field);
      this.sortDesc.set(true);
    }
  }

  getSortIcon(field: keyof TowerStats) {
    if (this.sortField() !== field) return '';
    return this.sortDesc() ? '↓' : '↑';
  }

  async loadData() {
    this.loading.set(true);
    const logs = await this.firebase.getBalanceLogs(this.currentVersion(), 1000);
    this.processLogs(logs);
    this.loading.set(false);
  }

  private processLogs(logs: any[]) {
    // 1. Group by gameId to count total games
    const gameIds = new Set(logs.map(l => l.gameId));
    const totalGames = gameIds.size || 1; // Avoid div by zero

    // 2. Group by Tower Type
    const grouped = new Map<number, any[]>();
    for (const log of logs) {
        const t = log.towerType;
        if (!grouped.has(t)) grouped.set(t, []);
        grouped.get(t)?.push(log);
    }

    // 3. Aggregate
    const results: TowerStats[] = [];
    const towerTypes = [1, 2, 3, 4, 5, 6, 7];

    for (const type of towerTypes) {
        const typeLogs = grouped.get(type) || [];
        const pickCount = typeLogs.length;
        
        // Sums
        const totalDmgPct = typeLogs.reduce((sum, l) => sum + (l.damagePercent || 0), 0);
        const totalRaw = typeLogs.reduce((sum, l) => sum + (l.damageRaw || 0), 0);
        const totalTier = typeLogs.reduce((sum, l) => sum + (l.towerTier || 1), 0);

        // Averages
        const avgDamagePercent = pickCount > 0 ? totalDmgPct / pickCount : 0;
        const avgRawDamage = pickCount > 0 ? totalRaw / pickCount : 0;
        const avgTier = pickCount > 0 ? totalTier / pickCount : 0;
        const pickRate = pickCount / totalGames;

        // Verdict
        let verdict: 'OP' | 'Weak' | 'Balanced' = 'Balanced';
        if (pickRate > 0.7 && avgDamagePercent > 30) verdict = 'OP';
        else if (pickRate < 0.1 || avgDamagePercent < 5) verdict = 'Weak';

        results.push({
            type,
            name: this.getTowerName(type),
            pickCount,
            totalDamagePercent: totalDmgPct,
            totalRawDamage: totalRaw,
            totalTier: totalTier,
            avgDamagePercent,
            avgRawDamage,
            avgTier,
            pickRate,
            verdict
        });
    }

    this.stats.set(results);
  }

  getTowerName(type: number): string {
    return this._waveAnalyticsService.getTowerName(type);

    // switch (type) {
    //     case 1: return 'Ice';
    //     case 2: return 'Lightning';
    //     case 3: return 'Cannon';
    //     case 4: return 'Sniper';
    //     case 5: return 'Inferno';
    //     case 6: return 'Prism';
    //     case 7: return 'Venom';
    //     default: return 'Unknown';
    // }
  }

  getTowerIcon(type: number): string {
    switch (type) {
        case 1: return '❄️';
        case 2: return '⚡';
        case 3: return '💣';
        case 4: return '🎯';
        case 5: return '🔥';
        case 6: return '🌈';
        case 7: return '☠️';
        default: return '❓';
    }
  }

  getScaleColor(value: number, high: number, low: number): string {
    if (value >= high) return 'text-emerald-400 font-bold';
    if (value <= low) return 'text-red-400 font-bold';
    return 'text-slate-300';
  }
}
