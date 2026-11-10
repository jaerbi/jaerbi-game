import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';

export interface FossilItem {
    id: string;
    name: string;
    icon: string;
    chaosValue: number;
    changePercent: number;
}

@Injectable({
    providedIn: 'root'
})
export class PoeNinjaService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);
    private workerUrl = 'https://tight-lab-5d5a.jaerbi42.workers.dev';

    getFossils(league: string = 'Allflame'): Observable<FossilItem[]> {
        if (!isPlatformBrowser(this.platformId)) {
            return of([]);
        }

        const url = `${this.workerUrl}?league=${league}&type=Fossil`;

        return this.http.get<any>(url).pipe(
            catchError(() => of(null)),
            map(res => {
                if (!res) return [];
                
                // Дані ринку лежать у lines, а метадані (картинки, назви) у масиві items
                const lines = res.lines || [];
                const itemsMeta = res.items || res.core?.items || [];

                const metaMap = new Map<string, any>();
                itemsMeta.forEach((m: any) => {
                    metaMap.set(m.id, m);
                });

                return lines.map((line: any) => {
                    // Отримуємо метадані за id предмета (наприклад, 'tangled-fossil')
                    const meta = metaMap.get(line.id) || {};
                    
                    // Збираємо правильну урлу іконки з поля image з метаданих
                    let iconUrl = meta.image || '';
                    if (iconUrl && iconUrl.startsWith('/')) {
                        iconUrl = `https://web.poecdn.com${iconUrl}`;
                    }

                    const sparklineData = line.sparkline?.data || [];
                    const totalChange = line.sparkline?.totalChange !== undefined 
                        ? Number(line.sparkline.totalChange) 
                        : this.calculateChange(sparklineData);

                    return {
                        id: line.id || '',
                        name: meta.name || line.id || 'Unknown',
                        icon: iconUrl,
                        chaosValue: line.primaryValue ?? 0,
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
