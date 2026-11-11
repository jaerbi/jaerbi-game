import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeagueStateService } from './league-state.service';

@Component({
  selector: 'app-league-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="league-selector-container">
      <label for="league-select">League: </label>
      <select 
        id="league-select" 
        [value]="leagueState.selectedLeague()" 
        (change)="onLeagueChange($event)">
        @for (league of leagueState.availableLeagues; track league.id) {
          <option [value]="league.id">{{ league.name }}</option>
        }
      </select>
    </div>
  `,
  styles: [`
    .league-selector-container {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #fff;
      font-family: inherit;
      select {
        background: #1a1a1a;
        color: #fff;
        border: 1px solid #333;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
      }
    }
  `]
})
export class LeagueSelectorComponent {
  readonly leagueState = inject(LeagueStateService);

  onLeagueChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    if (target) {
      this.leagueState.setLeague(target.value);
      
      // Тут ти можеш викликати перезавантаження даних у твоїх компонентах/сервісах,
      // наприклад, змусити підписки підтягнути нові дані для обраної ліги:
      // window.location.reload(); // або просто викликати методи сервісів заново
    }
  }
}
