import { Component, OnInit, inject, PLATFORM_ID, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PoeNinjaService, FossilItem } from './poe-ninja.service';
import { DelveBossesComponent } from './delve-bosses.component';
import { DelveSearchComponent } from './delve-search.component';
import { DelveSearchService } from './delve-search.service';
import { FossilHistoryChartComponent } from './fossil-history-chart.component';
import { LeagueSelectorComponent } from './league-selector.component';
import { LeagueStateService } from './league-state.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';

interface BiomeData {
    name: string;
    colorHex: string;
    icon: string;
    fossilKeywords: string[];
    expanded: boolean;
}

@Component({
    selector: 'app-poe-tracker',
    standalone: true,
    imports: [CommonModule, DelveBossesComponent, DelveSearchComponent, FossilHistoryChartComponent, LeagueSelectorComponent],
    templateUrl: 'poe-tracker.component.html'
})
export class PoeTrackerComponent implements OnInit, OnDestroy {
    private poeService = inject(PoeNinjaService);
    private platformId = inject(PLATFORM_ID);
    private searchService = inject(DelveSearchService);
    private leagueStateService = inject(LeagueStateService);

    loading = signal<boolean>(true);
    fossilsData = signal<FossilItem[]>([]);
    isInfoOpen = signal<boolean>(false);
    isDonateOpen = signal<boolean>(false);

    readonly onDestroy$ = new Subject<void>();
    private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 хвилин

    biomes = signal<BiomeData[]>([
        {
            name: 'Mines',
            colorHex: '#ffb6c1',
            icon: 'assets/images/poe/Delve_Biome_Mines.png',
            fossilKeywords: ['Metallic Fossil', 'Serrated Fossil', 'Pristine Fossil', 'Aetheric Fossil'],
            expanded: false
        },
        {
            name: 'Fungal Caverns',
            colorHex: '#90ee90',
            icon: 'assets/images/poe/Delve_Biome_Fungal_Caverns.png',
            fossilKeywords: ['Dense Fossil', 'Aberrant Fossil', 'Opulent Fossil', 'Corroded Fossil', 'Gilded Fossil', 'Tangled Fossil'],
            expanded: false
        },
        {
            name: 'Petrified Forest',
            colorHex: '#00ff00',
            icon: 'assets/images/poe/Delve_Biome_Petrified_Forest.png',
            fossilKeywords: ['Bound Fossil', 'Jagged Fossil', 'Corroded Fossil', 'Sanctified Fossil', 'Bloodstained Fossil'],
            expanded: false
        },
        {
            name: 'Abyssal Depths',
            colorHex: '#808080',
            icon: 'assets/images/poe/Delve_Biome_Abyssal_Depths.png',
            fossilKeywords: ['Aberrant Fossil', 'Bound Fossil', 'Gilded Fossil', 'Lucent Fossil', 'Hollow Fossil'],
            expanded: false
        },
        {
            name: 'Frozen Hollow',
            colorHex: '#00ffff',
            icon: 'assets/images/poe/Delve_Biome_Frozen_Hollow.png',
            fossilKeywords: ['Frigid Fossil', 'Serrated Fossil', 'Prismatic Fossil', 'Sanctified Fossil', 'Shuddering Fossil', 'Glyphic Fossil'],
            expanded: false
        },
        {
            name: 'Magma Fissure',
            colorHex: '#ffa500',
            icon: 'assets/images/poe/Delve_Biome_Magma_Fissure.png',
            fossilKeywords: ['Scorched Fossil', 'Prismatic Fossil', 'Pristine Fossil', 'Deft Fossil', 'Fundamental Fossil', 'Faceted Fossil'],
            expanded: false
        },
        {
            name: 'Sulphur Vents',
            colorHex: '#f5deb3',
            icon: 'assets/images/poe/Delve_Biome_Sulfur_Vents.png',
            fossilKeywords: ['Metallic Fossil', 'Opulent Fossil', 'Aetheric Fossil', 'Fundamental Fossil', 'Fractured Fossil'],
            expanded: false
        }
    ]);

    ngOnInit() {
        this.leagueStateService.getLeagueChange$()
            .pipe(
                debounceTime(300),
                takeUntil(this.onDestroy$)
            )
            .subscribe({
                next: () => {
                    // Спрацьовує, коли юзер міняє лігу
                    this.fetchData(false);
                }
            });
    }

    ngOnDestroy(): void {
        this.onDestroy$.next();
        this.onDestroy$.complete();
    }

    toggleInfoModal() {
        this.isInfoOpen.update(v => !v);
    }

    toggleDonateModal() {
        this.isDonateOpen.update(v => !v);
    }

    fetchData(ignoreCache: boolean) {
        if (!isPlatformBrowser(this.platformId)) {
            this.loading.set(false);
            return;
        }

        const currentLeague = this.leagueStateService.selectedLeague();

        // 🔑 Робимо ключі кешу унікальними для кожної ліги (наприклад, ..._Standard_v4 та ..._Allflame_v4)
        const cacheKey = `delvescout_fossils_cache_${currentLeague}_v4`;
        const cacheTimeKey = `delvescout_cache_time_${currentLeague}_v4`;

        const now = new Date().getTime();
        const cachedData = localStorage.getItem(cacheKey);
        const cachedTime = localStorage.getItem(cacheTimeKey);

        if (!ignoreCache && cachedData && cachedTime && (now - Number(cachedTime) < this.CACHE_DURATION)) {
            try {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.length > 0) {
                    this.fossilsData.set(parsed);
                    this.searchService.setFossils(parsed);
                    this.loading.set(false);
                    return;
                }
            } catch (e) {
                console.error('Cache read error:', e);
            }
        }

        this.loading.set(true);
        this.poeService.getFossils(currentLeague).subscribe({
            next: (data) => {
                this.fossilsData.set(data);
                this.searchService.setFossils(data);
                this.loading.set(false);

                if (data && data.length > 0) {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    localStorage.setItem(cacheTimeKey, now.toString());
                }
            },
            error: () => {
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        this.fossilsData.set(parsed);
                        this.searchService.setFossils(parsed);
                    } catch (e) { }
                }
                this.loading.set(false);
            }
        });
    }

    // Перемикаємо стан expanded безпосередньо для конкретного біома за його іменем
    toggleBiome(biomeName: string) {
        this.biomes.update(current =>
            current.map(b => b.name === biomeName ? { ...b, expanded: !b.expanded } : b)
        );
    }

    // Обчислюваний список біомів з цінами, середньою вартістю та трендом росту
    sortedBiomes = computed(() => {
        const fossils = this.fossilsData();

        const mapped = this.biomes().map(biome => {
            const matchedFossils = fossils.filter(f =>
                biome.fossilKeywords.some(keyword => f.name.toLowerCase().includes(keyword.toLowerCase()))
            );

            const totalValue = matchedFossils.reduce((sum, f) => sum + f.chaosValue, 0);
            const averageValue = matchedFossils.length > 0 ? totalValue / matchedFossils.length : 0;

            const totalChange = matchedFossils.reduce((sum, f) => sum + f.changePercent, 0);
            const averageChange = matchedFossils.length > 0 ? totalChange / matchedFossils.length : 0;

            return {
                ...biome,
                matchedFossils,
                averageValue,
                averageChange
            };
        });

        return mapped.sort((a, b) => b.averageValue - a.averageValue);
    });

    topGainers = computed(() => {
        return [...this.fossilsData()].sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
    });

    topLosers = computed(() => {
        return [...this.fossilsData()].sort((a, b) => a.changePercent - b.changePercent).slice(0, 3);
    });

    openExternalLink(url: string): void {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) {
            win.focus();
        }
    }

    copySupportLink(url: string) {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url);
            }
        } catch { }
    }
}
