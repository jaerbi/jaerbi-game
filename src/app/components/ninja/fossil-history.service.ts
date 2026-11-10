import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class FossilHistoryService {
    private http = inject(HttpClient);
    private platformId = inject(PLATFORM_ID);

    // 👇 ВСТАВ СЮДИ СВІЙ РЕАЛЬНИЙ ДОМЕН CLOUDFLARE WORKER (той самий, що використовується для інших запитів)
    private WORKER_URL = 'https://tight-lab-5d5a.jaerbi42.workers.dev';
    private STORAGE_PREFIX = 'delvescout_league_history_';

    CompareLeagues(fossilId: string): Observable<{ current: any[]; previous: any[] }> {
        const currentLeague = 'Mirage';
        const previousLeague = 'Allflame';

        const getLeagueData = (leagueName: string) => {
            const cacheKey = `${this.STORAGE_PREFIX}_${leagueName}_${fossilId}`;

            if (isPlatformBrowser(this.platformId) && leagueName === previousLeague) {
                const cached = localStorage.getItem(cacheKey);
                if (cached) return of(JSON.parse(cached));
            }

            // Передаємо параметри у твій воркер разом з id фосила
            const url = `${this.WORKER_URL}?league=${leagueName}&type=Fossil&id=${fossilId}`;

            return this.http.get<any>(url).pipe(
                tap(data => {
                    if (isPlatformBrowser(this.platformId) && leagueName === previousLeague && data) {
                        localStorage.setItem(cacheKey, JSON.stringify(data));
                    }
                })
            );
        };

        return forkJoin({
            currentRes: getLeagueData(currentLeague),
            previousRes: getLeagueData(previousLeague)
        }).pipe(
            map(({ currentRes, previousRes }) => {
                const extractHistory = (res: any) => {
                    const history = res?.pairs?.[0]?.history || res?.history || [];
                    return [...history].sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                };

                return {
                    current: extractHistory(currentRes),
                    previous: extractHistory(previousRes)
                };
            })
        );
    }
}
