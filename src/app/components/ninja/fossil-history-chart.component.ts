import { Component, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FossilHistoryService } from './fossil-history.service';

@Component({
    selector: 'app-fossil-history-chart',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './fossil-history-chart.component.html'
})
export class FossilHistoryChartComponent {
    private historyService = inject(FossilHistoryService);

    fossilsList = input<{ id: string; name: string; icon?: string }[]>([]);

    activeFossilId = signal<string | null>(null);
    loading = signal<boolean>(false);

    currentLeaguePoints = signal<{ day: number; rate: number }[]>([]);
    previousLeaguePoints = signal<{ day: number; rate: number }[]>([]);
    // Зберігає дані та точні координати точки для плаваючого попапа
    hoveredPoint = signal<{ day: number; rate: number; league: string; x: number; y: number } | null>(null);

    selectFossil(fossil: { id: string; name: string }) {
        this.activeFossilId.set(fossil.id);
        this.loading.set(true);

        this.historyService.CompareLeagues(fossil.id).subscribe({
            next: ({ current, previous }) => {
                // Групуємо та згладжуємо дані (наприклад, беремо середнє за кожні 4 дні)
                this.currentLeaguePoints.set(this.aggregateAndNormalize(current, 4));
                this.previousLeaguePoints.set(this.aggregateAndNormalize(previous, 4));
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Failed to load cross-league history', err);
                this.loading.set(false);
            }
        });
    }

    // Нормалізація + агрегація по N днів (зменшуємо кількість точок, залишаючи чистий тренд)
    private normalizeByDay(rawHistory: any[]): { day: number; rate: number }[] {
        if (!rawHistory.length) return [];
        const startTimestamp = new Date(rawHistory[0].timestamp).getTime();

        return rawHistory.map(item => {
            const itemTime = new Date(item.timestamp).getTime();
            const day = Math.max(1, Math.floor((itemTime - startTimestamp) / (1000 * 60 * 60 * 24)) + 1);
            return { day, rate: item.rate };
        });
    }

    private aggregateAndNormalize(rawHistory: any[], stepDays: number = 4): { day: number; rate: number }[] {
        const normalized = this.normalizeByDay(rawHistory);
        if (!normalized.length) return [];

        const grouped: { [key: number]: { sum: number; count: number } } = {};

        normalized.forEach(pt => {
            const bucket = Math.floor((pt.day - 1) / stepDays) * stepDays + 1;
            if (!grouped[bucket]) {
                grouped[bucket] = { sum: 0, count: 0 };
            }
            grouped[bucket].sum += pt.rate;
            grouped[bucket].count += 1;
        });

        return Object.keys(grouped).map(bucketStr => {
            const day = Number(bucketStr);
            const { sum, count } = grouped[day];
            return {
                day,
                rate: Math.round((sum / count) * 100) / 100 // Середнє значення за період
            };
        });
    }

    globalMaxPrice = computed(() => {
        const all = [...this.currentLeaguePoints(), ...this.previousLeaguePoints()];
        if (!all.length) return 100;
        return Math.max(...all.map(p => p.rate));
    });

    globalMinPrice = computed(() => {
        const all = [...this.currentLeaguePoints(), ...this.previousLeaguePoints()];
        if (!all.length) return 0;
        return Math.min(...all.map(p => p.rate));
    });

    calcX(day: number): number {
        const maxDay = Math.max(
            ...this.currentLeaguePoints().map(p => p.day),
            ...this.previousLeaguePoints().map(p => p.day),
            90
        );
        return (day / maxDay) * 800;
    }

    calcY(rate: number): number {
        const min = this.globalMinPrice();
        const max = this.globalMaxPrice();
        const range = max - min || 1;
        const height = 250;
        return height - ((rate - min) / range) * (height - 20) - 10;
    }

    svgPath(points: { day: number; rate: number }[]): string {
        if (points.length < 2) return '';
        return points.map((pt, index) => {
            const x = this.calcX(pt.day);
            const y = this.calcY(pt.rate);
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ');
    }
}
