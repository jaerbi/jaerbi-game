import { Component, OnInit, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { DelveBossesService, BossItem } from './delve-bosses.service';

interface BossDrop {
    name: string;
    dropRate: number; // наприклад, 0.4 для 40%
}

interface BossData {
    name: string;
    title: string;
    colorHex: string;
    expanded: boolean;
    drops: BossDrop[];
}

@Component({
    selector: 'app-delve-bosses',
    standalone: true,
    imports: [CommonModule],
    templateUrl: 'delve-bosses.component.html'
})
export class DelveBossesComponent implements OnInit {
    private bossService = inject(DelveBossesService);
    private platformId = inject(PLATFORM_ID);

    loading = signal<boolean>(true);
    bossItemsMap = signal(new Map());
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
            title: 'Delve Boss #1',
            colorHex: '#a855f7',
            expanded: false,
            drops: [
                { name: 'Hale Negator (1 socket)', dropRate: 0.40 },
                { name: 'Hale Negator (2 socket)', dropRate: 0.10 },
                { name: 'Command of the Pit (1 socket)', dropRate: 0.15 },
                { name: 'Command of the Pit (2 socket)', dropRate: 0.05 },
                { name: "Ahkeli's Valley", dropRate: 0.10 },
                { name: "Uzaza's Mountain", dropRate: 0.10 },
                { name: "Putembo's Meadow", dropRate: 0.10 },
                { name: "Zorath's Eye of the Inevitable", dropRate: 0.50 }
            ]
        },
        {
            name: 'Ahuatotli, the Blind',
            title: 'Delve Boss #2',
            colorHex: '#3b82f6',
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
            title: 'Delve Boss #3',
            colorHex: '#f59e0b',
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
        this.fetchBossData();
    }

    fetchBossData(ignoreCache: boolean = false) {
        if (!isPlatformBrowser(this.platformId)) {
            this.loading.set(false);
            return;
        }

        this.loading.set(true);
        this.bossService.getBossItems('Allflame', ignoreCache).subscribe({
            next: (mapData) => {
                this.bossItemsMap.set(mapData);
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
