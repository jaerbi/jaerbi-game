import { Injectable, signal } from '@angular/core';
import { BossItem } from './delve-bosses.service';

export interface DelveSearchItem {
    id: string;
    name: string;
    icon: string;
    chaosValue: number;
    changePercent: number;
    category: 'Fossil' | 'Boss Drop';
}

@Injectable({
    providedIn: 'root'
})
export class DelveSearchService {
    // Список назв усіх унікальних предметів із дельвівських босів
    private readonly ALLOWED_BOSS_DROPS = new Set<string>([
        'hale negator', 'command of the pit', "ahkeli's valley",
        "uzaza's mountain", "putembo's meadow", "zorath's eye of the inevitable",
        'cerberus limb', 'doryani\'s machination', "ahkeli's meadow",
        "uzaza's valley", "putembo's mountain",
        "aul's uprising", 'crown of the tyrant', "ahkeli's mountain",
        "uzaza's meadow", "putembo's valley", "curiosity", "reliquary key"
    ]);

    // Головний сигнал із даними
    allItems = signal<DelveSearchItem[]>([]);

    // Додаємо окремо фосили
    setFossils(fossilsMap: any[]) {
        const current = this.allItems();
        const nonFossils = current.filter(i => i.category !== 'Fossil');

        const fossilItems: DelveSearchItem[] = [];
        fossilsMap.forEach((fossil) => {
            fossilItems.push({
                id: fossil.id || fossil.name,
                name: fossil.name,
                icon: fossil.icon,
                chaosValue: fossil.chaosValue || fossil.value || 0,
                changePercent: fossil.changePercent || 0,
                category: 'Fossil'
            });
        });

        this.allItems.set([...nonFossils, ...fossilItems].sort((a, b) => b.chaosValue - a.chaosValue));
    }

    // Додаємо окремо босів
    setBossItems(bossItemsMap: Map<any, any>) {
        const current = this.allItems();
        const nonBosses = current.filter(i => i.category !== 'Boss Drop');

        const bossItems: DelveSearchItem[] = [];
        bossItemsMap.forEach((item) => {
            const normalizedName = item.name.toLowerCase().trim();
            const isAllowed = Array.from(this.ALLOWED_BOSS_DROPS).some(allowed =>
                normalizedName.includes(allowed)
            );

            if (isAllowed) {
                bossItems.push({
                    id: item.id || item.name,
                    name: item.name,
                    icon: item.icon,
                    chaosValue: item.chaosValue,
                    changePercent: item.changePercent,
                    category: 'Boss Drop'
                });
            }
        });

        this.allItems.set([...nonBosses, ...bossItems].sort((a, b) => b.chaosValue - a.chaosValue));
    }
}
