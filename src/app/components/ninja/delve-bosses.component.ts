import { Component, OnInit, OnDestroy, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DelveBossesService, BossItem } from './delve-bosses.service';
import { DelveSearchService } from './delve-search.service';
import { LeagueStateService } from './league-state.service';
import { debounceTime, Subject, takeUntil } from 'rxjs';

interface BossDrop {
    name: string;
    dropRate: number; // наприклад, 0.4 для 40%
}

interface BossData {
    name: string;
    title: string;
    colorHex: string;
    icon: string;
    expanded: boolean;
    drops: BossDrop[];
}

@Component({
    selector: 'app-delve-bosses',
    standalone: true,
    imports: [CommonModule],
    templateUrl: 'delve-bosses.component.html'
})
export class DelveBossesComponent implements OnInit, OnDestroy {
    private bossService = inject(DelveBossesService);
    private platformId = inject(PLATFORM_ID);
    private searchService = inject(DelveSearchService);
    private leagueStateService = inject(LeagueStateService);

    loading = signal<boolean>(true);
    bossItemsMap = signal(new Map());

    readonly onDestroy$ = new Subject<void>();

    // Топ-3 найдорожчих предметів, які реально випадають з босів
    topBossItems = computed(() => {
        const bosses = this.sortedBosses(); // Використовуємо вже розраховані дані босів з цінами
        const allDropsMap = new Map<string, { name: string; icon?: string; chaosValue: number; changePercent: number }>();

        // Збираємо всі унікальні дропи з усіх босів у єдину мапу (щоб не було дублікатів)
        bosses.forEach(boss => {
            boss.drops.forEach(drop => {
                if (drop.matchedItem && drop.itemPrice > 0) {
                    allDropsMap.set(drop.name, {
                        name: drop.matchedItem.name || drop.name,
                        icon: drop.matchedItem.icon,
                        chaosValue: drop.itemPrice,
                        changePercent: drop.matchedItem.changePercent
                    });
                }
            });
        });

        // Перетворюємо в масив, сортуємо за ціною у спадному порядку та беремо топ-3
        return Array.from(allDropsMap.values())
            .sort((a, b) => b.chaosValue - a.chaosValue)
            .slice(0, 3);
    });

    bosses = signal<BossData[]>([
        {
            name: 'Kurgal, the Blackblooded',
            title: "The Lich's Tomb",
            colorHex: '#a855f7',
            icon: "assets/images/poe/The_Lich's_Tomb_delve_node_icon.png",
            expanded: false,
            drops: [
                { name: 'Hale Negator', dropRate: 0.40 },
                { name: 'Command of the Pit', dropRate: 0.15 },
                { name: "Ahkeli's Valley", dropRate: 0.10 },
                { name: "Uzaza's Mountain", dropRate: 0.10 },
                { name: "Putembo's Meadow", dropRate: 0.10 },
                { name: "Zorath's Eye of the Inevitable", dropRate: 0.50 }
            ]
        },
        {
            name: 'Ahuatotli, the Blind',
            title: "The Grand Architect's Temple",
            colorHex: '#3b82f6',
            icon: "assets/images/poe/The_Grand_Architect's_Temple_delve_node_icon.png",
            expanded: false,
            drops: [
                { name: 'Cerberus Limb', dropRate: 0.60 },
                { name: "Ahkeli's Mountain", dropRate: 0.08 },
                { name: "Uzaza's Meadow", dropRate: 0.08 },
                { name: "Putembo's Valley", dropRate: 0.08 },
                { name: "Doryani's Machinarium", dropRate: 0.16 },
                { name: 'Curiosity', dropRate: 0.40 }
            ]
        },
        {
            name: 'Aul, the Crystal King',
            title: "The Crystal King's Throne",
            colorHex: '#f59e0b',
            icon: "assets/images/poe/The_Crystal_King's_Throne_delve_node_icon.png",
            expanded: false,
            drops: [
                { name: "Aul's Uprising", dropRate: 0.61 },
                { name: 'Crown of the Tyrant', dropRate: 0.15 },
                { name: "Ahkeli's Meadow", dropRate: 0.08 },
                { name: "Uzaza's Valley", dropRate: 0.08 },
                { name: "Putembo's Mountain", dropRate: 0.08 }
            ]
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
                    this.fetchBossData(false);
                }
            });
    }

    ngOnDestroy(): void {
        this.onDestroy$.next();
        this.onDestroy$.complete();
    }

    fetchBossData(ignoreCache: boolean = false) {
        if (!isPlatformBrowser(this.platformId)) {
            this.loading.set(false);
            return;
        }

        this.loading.set(true);
        const currentLeague = this.leagueStateService.selectedLeague();

        // Сервіс DelveBossesService вже приймає лігу та керує кешем усередині себе
        this.bossService.getBossItems(currentLeague, ignoreCache).subscribe({
            next: (mapData) => {
                this.bossItemsMap.set(mapData);
                this.searchService.setBossItems(mapData);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
            }
        });
    }

    toggleBoss(bossName: string) {
        this.bosses.update(current =>
            current.map(b => b.name === bossName ? { ...b, expanded: !b.expanded } : b)
        );
    }

    // Розрахунок очікуваної вартості (EV) для кожного боса та сортування від найпрофітнішого
    sortedBosses = computed(() => {
        const itemsMap = this.bossItemsMap();

        const mapped = this.bosses().map(boss => {
            let totalExpectedValue = 0;

            const evaluatedDrops = boss.drops.map(drop => {
                const searchKey = drop.name.split('(')[0].toLowerCase().trim();
                let matchedItem: BossItem | undefined;

                for (const [key, item] of itemsMap.entries()) {
                    if (key.includes(searchKey) || searchKey.includes(key)) {
                        matchedItem = item;
                        break;
                    }
                }

                const itemPrice = matchedItem ? matchedItem.chaosValue : 0;
                totalExpectedValue += itemPrice * drop.dropRate;

                return {
                    ...drop,
                    matchedItem,
                    itemPrice
                };
            });

            return {
                ...boss,
                drops: evaluatedDrops,
                averageProfit: totalExpectedValue
            };
        });

        return mapped.sort((a, b) => b.averageProfit - a.averageProfit);
    });
}
