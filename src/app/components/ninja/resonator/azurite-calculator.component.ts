import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ResonatorService, ResonatorDeal } from './resonator.service';
import { LeagueStateService } from '../league-state.service';

export interface CalculatedDeal extends ResonatorDeal {
  canBuyCount: number;
  totalChaosReturn: number;
  azuriteLeftover: number;
  isBest: boolean;
}

@Component({
  selector: 'app-azurite-calculator',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './azurite-calculator.component.html'
})
export class AzuriteCalculatorComponent {
  private resonatorService = inject(ResonatorService);
  private leagueState = inject(LeagueStateService);

  azuriteAmount = signal<number>(30000);
  deals = signal<ResonatorDeal[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  // Пресети для швидкого кліку
  presets = [10000, 30000, 100000, 250000];

  constructor() {
    // Автоматично перезавантажує дані при зміні ліги
    effect(() => {
      const currentLeague = this.leagueState.selectedLeague();
      this.loadDeals(currentLeague);
    });
  }

  calculatedDeals = computed<CalculatedDeal[]>(() => {
    const azurite = Math.max(0, Number(this.azuriteAmount()) || 0);
    const list = this.deals();
    if (!list.length) return [];

    const maxRate = Math.max(...list.map((d) => d.chaosPer1kAzurite));

    return list.map((deal) => {
      const canBuyCount = Math.floor(azurite / deal.azuriteCost);
      const totalChaosReturn = canBuyCount * deal.chaosPrice;
      const azuriteLeftover = azurite % deal.azuriteCost;

      return {
        ...deal,
        canBuyCount,
        totalChaosReturn,
        azuriteLeftover,
        isBest: deal.chaosPer1kAzurite > 0 && deal.chaosPer1kAzurite === maxRate
      };
    });
  });

  bestDeal = computed(() => this.calculatedDeals().find((d) => d.isBest) || null);

  loadDeals(league: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.resonatorService.getResonatorDeals(league).subscribe({
      next: (data) => {
        this.deals.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load resonator deals:', err);
        this.error.set('Failed to load resonator prices');
        this.loading.set(false);
      }
    });
  }

  setPreset(amount: number): void {
    this.azuriteAmount.set(amount);
  }
}
