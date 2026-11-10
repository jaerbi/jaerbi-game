import { Component, OnInit, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PoeNinjaService, FossilItem } from './poe-ninja.service';
import { DelveBossesComponent } from './delve-bosses.component';
import { DelveSearchComponent } from './delve-search.component';
import { DelveSearchService } from './delve-search.service';

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
    imports: [CommonModule, DelveBossesComponent, DelveSearchComponent],
    templateUrl: 'poe-tracker.component.html'
})
export class PoeTrackerComponent implements OnInit {
    private poeService = inject(PoeNinjaService);
    private platformId = inject(PLATFORM_ID);
    private searchService = inject(DelveSearchService);

    loading = signal<boolean>(true);
    fossilsData = signal<FossilItem[]>([]);

    private readonly CACHE_KEY = 'delvescout_fossils_cache_v4';
    private readonly CACHE_TIME_KEY = 'delvescout_cache_time_v4';
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
            fossilKeywords: ['Dense Fossil', 'Aberrant Fossil', 'Opulent Fossil', 'Corroded Fossil', 'Gilded Fossil'],
            expanded: false
        },
        {
            name: 'Petrified Forest',
            colorHex: '#00ff00',
            icon: 'assets/images/poe/Delve_Biome_Petrified_Forest.png',
            fossilKeywords: ['Bound Fossil', 'Jagged Fossil', 'Corroded Fossil', 'Sanctified Fossil'],
            expanded: false
        },
        {
            name: 'Abyssal Depths',
            colorHex: '#808080',
            icon: 'assets/images/poe/Delve_Biome_Abyssal_Depths.png',
            fossilKeywords: ['Aberrant Fossil', 'Bound Fossil', 'Gilded Fossil', 'Lucent Fossil'],
            expanded: false
        },
        {
            name: 'Frozen Hollow',
            colorHex: '#00ffff',
            icon: 'assets/images/poe/Delve_Biome_Frozen_Hollow.png',
            fossilKeywords: ['Frigid Fossil', 'Serrated Fossil', 'Prismatic Fossil', 'Sanctified Fossil', 'Shuddering Fossil'],
            expanded: false
        },
        {
            name: 'Magma Fissure',
            colorHex: '#ffa500',
            icon: 'assets/images/poe/Delve_Biome_Magma_Fissure.png',
            fossilKeywords: ['Scorched Fossil', 'Prismatic Fossil', 'Pristine Fossil', 'Deft Fossil', 'Fundamental Fossil'],
            expanded: false
        },
        {
            name: 'Sulphur Vents',
            colorHex: '#f5deb3',
            icon: 'assets/images/poe/Delve_Biome_Sulfur_Vents.png',
            fossilKeywords: ['Metallic Fossil', 'Opulent Fossil', 'Aetheric Fossil', 'Fundamental Fossil'],
            expanded: false
        }
    ]);

    ngOnInit() {
        this.fetchData(false);
    }

    forceRefresh() {
        if (!isPlatformBrowser(this.platformId)) return;
        localStorage.removeItem(this.CACHE_KEY);
        localStorage.removeItem(this.CACHE_TIME_KEY);
        this.fetchData(true);
    }

    fetchData(ignoreCache: boolean) {
        if (!isPlatformBrowser(this.platformId)) {
            this.loading.set(false);
            return;
        }

        const now = new Date().getTime();
        const cachedData = localStorage.getItem(this.CACHE_KEY);
        const cachedTime = localStorage.getItem(this.CACHE_TIME_KEY);

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
        this.poeService.getFossils('Allflame').subscribe({
            next: (data) => {
                this.fossilsData.set(data);
                console.log('data: ', data);
                this.searchService.setFossils(data);
                this.loading.set(false);

                if (data && data.length > 0) {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
                    localStorage.setItem(this.CACHE_TIME_KEY, now.toString());
                    if (cachedData && cachedTime && (now - Number(cachedTime) < this.CACHE_DURATION)) {
                        try {
                            const parsedData = JSON.parse(cachedData);
                            if (parsedData && parsedData.length > 0) {
                                this.fossilsData.set(parsedData);
                                this.searchService.setFossils(parsedData);
                                console.log('parsedData: ', parsedData);
                                this.loading.set(false);
                                return;
                            }
                        } catch (e) {
                            console.error('Cache parse error:', e);
                        }
                    }
                }
            },
            error: () => {
                if (cachedData) {
                    try {
                        this.fossilsData.set(JSON.parse(cachedData));
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
}
