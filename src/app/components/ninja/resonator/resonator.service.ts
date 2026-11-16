import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LeagueStateService } from '../league-state.service';

export interface ResonatorDeal {
  id: string;
  name: string;
  icon: string;
  azuriteCost: number;
  chaosPrice: number;
  chaosPer1kAzurite: number;
  changePercent: number;
}

const NIKO_RESONATORS: { id: string; defaultName: string; azuriteCost: number }[] = [
  { id: 'primitive-chaotic-resonator', defaultName: 'Primitive Chaotic Resonator', azuriteCost: 300 },
  { id: 'potent-chaotic-resonator', defaultName: 'Potent Chaotic Resonator', azuriteCost: 750 },
  { id: 'powerful-chaotic-resonator', defaultName: 'Powerful Chaotic Resonator', azuriteCost: 3750 }
];

@Injectable({
  providedIn: 'root'
})
export class ResonatorService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private leagueState = inject(LeagueStateService);
  private workerUrl = 'https://tight-lab-5d5a.jaerbi42.workers.dev';

  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 хвилин

  getResonatorDeals(league?: string, ignoreCache: boolean = false): Observable<ResonatorDeal[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    const targetLeague = league || this.leagueState.selectedLeague();
    const cacheKey = `delvescout_resonators_cache_${targetLeague}_v1`;
    const cacheTimeKey = `delvescout_resonators_cache_time_${targetLeague}_v1`;

    const now = Date.now();
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);

    if (!ignoreCache && cachedData && cachedTime && now - Number(cachedTime) < this.CACHE_DURATION) {
      try {
        const parsed: ResonatorDeal[] = JSON.parse(cachedData);
        if (parsed && parsed.length > 0) {
          return of(parsed);
        }
      } catch (e) {
        console.error(`Resonator cache read error for league ${targetLeague}:`, e);
      }
    }

    const url = `${this.workerUrl}?league=${encodeURIComponent(targetLeague)}&type=Resonator`;

    return this.http.get<any>(url).pipe(
      catchError((err) => {
        console.error(`Error fetching Resonators for league ${targetLeague}:`, err);
        return of(null);
      }),
      map((res) => {
        if (!res) return [];

        const lines = res.lines || res.core?.lines || [];
        const itemsMeta = res.items || res.core?.items || [];

        const metaMap = new Map<string, any>();
        itemsMeta.forEach((m: any) => metaMap.set(m.id, m));

        const lineMap = new Map<string, any>();
        lines.forEach((l: any) => lineMap.set(l.id, l));

        const deals: ResonatorDeal[] = NIKO_RESONATORS.map((nikoItem) => {
          const meta = metaMap.get(nikoItem.id) || {};
          const line = lineMap.get(nikoItem.id) || {};

          let iconUrl = meta.image || line.icon || '';
          if (iconUrl && iconUrl.startsWith('/')) {
            iconUrl = `https://web.poecdn.com${iconUrl}`;
          }

          const chaosPrice = Number(line.primaryValue ?? line.chaosValue ?? 0);
          const chaosPer1kAzurite = chaosPrice > 0 ? (1000 / nikoItem.azuriteCost) * chaosPrice : 0;

          const sparkLineObj = line.sparkline || line.sparkLine || {};
          const changePercent = Number(sparkLineObj.totalChange ?? 0);

          return {
            id: nikoItem.id,
            name: meta.name || nikoItem.defaultName,
            icon: iconUrl,
            azuriteCost: nikoItem.azuriteCost,
            chaosPrice,
            chaosPer1kAzurite,
            changePercent
          };
        });

        try {
          localStorage.setItem(cacheKey, JSON.stringify(deals));
          localStorage.setItem(cacheTimeKey, now.toString());
        } catch (e) {
          console.error(`Resonator cache write error for league ${targetLeague}:`, e);
        }

        return deals;
      })
    );
  }
}
