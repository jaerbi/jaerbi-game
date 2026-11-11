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

    // Вхідний список усіх фосиліїв від батьківського компонента
    fossilsList = input<{ id: string; name: string; icon?: string }[]>([]);

    // Фільтруємо список, залишаючи лише ті фосили, які присутні в обох історичних лігах (Mirage / Allflame)
    filteredFossilsList = computed(() => {
        const rawList = this.fossilsList();
        if (!rawList || !rawList.length) return [];

        // Список ID фосиліїв, які гарантовано є і в Mirage, і в Allflame на основі актуальних даних poe.ninja
        const validHistoricalFossils = new Set([
            'gilded-fossil',
            'hollow-fossil',
            'faceted-fossil',
            'fractured-fossil',
            'shuddering-fossil',
            'opulent-fossil',
            'aetheric-fossil',
            'pristine-fossil',
            'corroded-fossil',
            'metallic-fossil',
            'scorched-fossil',
            'jagged-fossil',
            'dense-fossil',
            'aberrant-fossil',
            'lucent-fossil',
            'frigid-fossil',
            'deft-fossil',
            'bound-fossil',
            'sanctified-fossil',
            'prismatic-fossil',
            'serrated-fossil',
            'tangled-fossil',
            'bloodstained-fossil',
            'fundamental-fossil',
            'glyphic-fossil'
        ]);

        return rawList.filter(f => validHistoricalFossils.has(f.id));
    });

    activeFossilId = signal<string | null>(null);
    loading = signal<boolean>(false);
    hasError = signal<boolean>(false);

    currentLeaguePoints = signal<{ day: number; rate: number }[]>([]);
    previousLeaguePoints = signal<{ day: number; rate: number }[]>([]);
    hoveredPoint = signal<{ day: number; rate: number; league: string; x: number; y: number } | null>(null);

    selectFossil(fossil: { id: string; name: string }) {
        this.activeFossilId.set(fossil.id);
        this.loading.set(true);
        this.hasError.set(false);

        this.historyService.CompareLeagues(fossil.id).subscribe({
            next: ({ current, previous }) => {
                const currentNormalized = this.aggregateAndNormalize(current, 4);
                const previousNormalized = this.aggregateAndNormalize(previous, 4);

                this.currentLeaguePoints.set(currentNormalized);
                this.previousLeaguePoints.set(previousNormalized);

                if (currentNormalized.length === 0 && previousNormalized.length === 0) {
                    this.hasError.set(true);
                }

                this.loading.set(false);
            },
            error: (err) => {
                console.error('Failed to load cross-league history', err);
                this.loading.set(false);
                this.hasError.set(true);
            }
        });
    }

    private normalizeByDay(rawHistory: any[]): { day: number; rate: number }[] {
        if (!rawHistory || !rawHistory.length) return [];
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
                rate: Math.round((sum / count) * 100) / 100
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
