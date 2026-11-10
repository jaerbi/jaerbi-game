import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, concat, of, catchError, map, toArray } from 'rxjs';

export interface BossItem {
    id: string;
    name: string;
    icon: string;
    chaosValue: number;
    changePercent: number;
}

@Injectable({
    providedIn: 'root'
})
export class DelveBossesService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);
    private workerUrl = 'https://tight-lab-5d5a.jaerbi42.workers.dev';

    private readonly CACHE_KEY = 'delvescout_bosses_cache_v3';
    private readonly CACHE_TIME_KEY = 'delvescout_bosses_cache_time_v3';
    private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 хвилин

    getBossItems(league: string = 'Allflame', ignoreCache: boolean = false): Observable<Map<any, any>> {
        if (!isPlatformBrowser(this.platformId)) {
            return of(new Map());
        }

        const now = new Date().getTime();
        const cachedData = localStorage.getItem(this.CACHE_KEY);
        const cachedTime = localStorage.getItem(this.CACHE_TIME_KEY);

        if (!ignoreCache && cachedData && cachedTime && (now - Number(cachedTime) < this.CACHE_DURATION)) {
            try {
                const parsedArray: [string, BossItem][] = JSON.parse(cachedData);
                if (parsedArray && parsedArray.length > 0) {
                    return of(new Map(parsedArray));
                }
            } catch (e) {
                console.error('Boss cache read error:', e);
            }
        }

        // Повний список категорій poe.ninja, де живуть дропи дельвівських босів
        const types = [
            'UniqueArmour', 
            'UniqueAccessory', 
            'UniqueWeapon', 
            'UniqueJewel', 
            'UniqueMap', 
            'Fragment'
        ];

        return concat(
            ...types.map(type => this.fetchCategory(league, type))
        ).pipe(
            toArray(),
            map((responses: BossItem[][]) => {
                const combinedMap = new Map<string, BossItem>();
                const allItems = responses.flat();

                allItems.forEach(item => {
                    combinedMap.set(item.name.toLowerCase().trim(), item);
                });

                try {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify(Array.from(combinedMap.entries())));
                    localStorage.setItem(this.CACHE_TIME_KEY, now.toString());
                } catch (e) {
                    console.error('Boss cache write error:', e);
                }

                return combinedMap;
            })
        );
    }

    private fetchCategory(league: string, type: string): Observable<BossItem[]> {
        const url = `${this.workerUrl}?league=${league}&type=${type}`;

        return this.http.get<any>(url).pipe(
            catchError((err) => {
                console.error(`Error fetching ${type}:`, err);
                return of(null);
            }),
            map(res => {
                if (!res) return [];

                const lines = res.lines || res.core?.lines || [];
                const itemsMeta = res.items || res.core?.items || [];

                const metaMap = new Map<string, any>();
                itemsMeta.forEach((m: any) => {
                    metaMap.set(m.id, m);
                });

                return lines.map((line: any) => {
                    const meta = metaMap.get(line.id) || {};
                    const itemName = meta.name || line.name || line.id || 'Unknown';

                    let iconUrl = meta.image || line.icon || '';
                    if (iconUrl && iconUrl.startsWith('/')) {
                        iconUrl = `https://web.poecdn.com${iconUrl}`;
                    }

                    const price = line.chaosValue ?? line.primaryValue ?? line.chaosEquivalent ?? line.value ?? 0;

                    const sparklineData = line.sparkline?.data || [];
                    const totalChange = line.sparkline?.totalChange !== undefined
                        ? Number(line.sparkline.totalChange)
                        : this.calculateChange(sparklineData);

                    return {
                        id: line.id || itemName,
                        name: itemName,
                        icon: iconUrl,
                        chaosValue: price,
                        changePercent: totalChange
                    };
                });
            })
        );
    }

    private calculateChange(history: (number | null)[]): number {
        const validData = history.filter((val): val is number => val !== null);
        if (validData.length < 2) return 0;
        const first = validData[0];
        const last = validData[validData.length - 1];
        if (first === 0) return 0;
        return Number((((last - first) / first) * 100).toFixed(2));
    }
}
