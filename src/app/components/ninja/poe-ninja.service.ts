import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, catchError } from 'rxjs';

export interface NinjaItem {
    id: string;
    name: string;
    icon: string;
    chaosValue: number;
    sparkline: { data: (number | null)[] };
    changePercent: number;
    trend: 'up' | 'down' | 'neutral';
}

@Injectable({
    providedIn: 'root'
})
export class PoeNinjaService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);
    private workerUrl = 'https://tight-lab-5d5a.jaerbi42.workers.dev';

    getItems(league: string = 'Allflame', type: string = 'Currency'): Observable<NinjaItem[]> {
        if (!isPlatformBrowser(this.platformId)) {
            return of([]);
        }

        const url = `${this.workerUrl}?league=${league}&type=${type}`;

        return this.http.get<any>(url).pipe(
            catchError(() => of(null)),
            map(res => {
                if (!res) return [];
                const lines = res.lines || [];
                const itemsMeta = res.core?.items || res.items || [];

                const metaMap = new Map<string, any>();
                itemsMeta.forEach((m: any) => {
                    metaMap.set(m.id, m);
                });

                return lines.map((line: any) => {
                    const meta = metaMap.get(line.id) || {};
                    return { ...line, ...meta };
                }).map((item: any) => this.formatItem(item));
            })
        );
    }

    private formatItem(item: any): NinjaItem {
        // У новому API шлях до картинки може бути в поле image або icon
        let iconUrl = item.image || item.icon || '';
        if (iconUrl && iconUrl.startsWith('/')) {
            iconUrl = `https://poe.ninja${iconUrl}`;
        }

        const sparklineData = item.sparkline?.data || [];
        const changePercent = item.sparkline?.totalChange !== undefined 
            ? Number(item.sparkline.totalChange) 
            : this.calculateChange(sparklineData);

        return {
            id: item.id || '',
            name: item.name || item.id || 'Unknown',
            icon: iconUrl,
            chaosValue: item.primaryValue ?? item.chaosValue ?? 0,
            sparkline: { data: sparklineData },
            changePercent,
            trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'neutral'
        };
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
