import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeagueStateService } from './league-state.service';

@Component({
    selector: 'app-league-selector',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="relative min-w-[160px] sm:min-w-[180px] bg-[#1d262fe6] hover:bg-slate-800/90 border border-slate-700 hover:border-slate-500 transition-colors cursor-pointer select-none rounded-none">
      <!-- Візуальний шар (підпис зверху + значення знизу) -->
      <div class="px-3.5 py-1.5 pr-9 pointer-events-none flex flex-col justify-center">
        <span class="text-[11px] text-slate-400 leading-tight font-medium">League</span>
        <span class="text-sm text-slate-100 font-semibold leading-snug mt-0.5 truncate">
          {{ selectedLeagueName }}
        </span>
      </div>

      <!-- Стрілочка справа -->
      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>

      <!-- Прозорий нативний select поверх усього блоку для кліку -->
      <select
        id="league-select"
        aria-label="League"
        [value]="leagueState.selectedLeague()"
        (change)="onLeagueChange($event)"
        class="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-slate-900 text-slate-100"
      >
        @for (league of leagueState.availableLeagues; track league.id) {
          <option [value]="league.id" class="bg-slate-900 text-slate-100 py-2">
            {{ league.name }}
          </option>
        }
      </select>
    </div>
  `
})
export class LeagueSelectorComponent {
    readonly leagueState = inject(LeagueStateService);

    get selectedLeagueName(): string {
        const currentId = this.leagueState.selectedLeague();
        const found = this.leagueState.availableLeagues.find(l => l.id === currentId);
        return found ? found.name : currentId;
    }

    onLeagueChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        if (target) {
            this.leagueState.setLeague(target.value);
        }
    }
}
