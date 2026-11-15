import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LeagueStateService } from '../league-state.service';

export const TALISMAN_BASE_TYPES: string[] = [
  'Ape Talisman', 'Black Maw Talisman', 'Black Widow Talisman', 'Blood Viper Talisman',
  'Carrion Queen Talisman', 'Chieftain Talisman', 'Chimeral Talisman', 'Cobra Talisman',
  'Craicic Talisman', 'Croaker Talisman', 'Devourer Talisman', 'Farric Talisman',
  'Fenumal Talisman', 'Flame Hellion Talisman', 'Frost Hellion Talisman', 'Gargantuan Talisman',
  'Goatman Talisman', 'Goliath Talisman', 'Great Maw Talisman', 'Greatwolf Talisman',
  'Hybrid Arachnid Talisman', 'Lynx Talisman', 'Magma Hound Talisman', 'Octopus Talisman',
  'Pitbull Talisman', 'Plagued Arachnid Talisman', 'Retch Talisman', 'Rhex Talisman',
  'Rhoa Talisman', 'Sand Spitter Talisman', 'Saqawine Talisman', 'Savage Crab Talisman',
  'Scorpion Talisman', 'Scrabbler Talisman', 'Shield Crab Talisman', 'Spider Crab Talisman',
  'Squid Talisman', 'Taurus Talisman', 'Tiger Talisman', 'Ursa Talisman',
  'Vulture Talisman', 'Watcher Talisman', 'Wolf Alpha Talisman'
];

const TALISMAN_SET = new Set(TALISMAN_BASE_TYPES);

export interface TalismanItem {
  id: string;
  name: string;
  icon: string;
  chaosValue: number;
  divineValue: number;
  levelRequired: number;
}

@Injectable({
  providedIn: 'root'
})
export class TalismanService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private leagueState = inject(LeagueStateService);
  private workerUrl = 'https://tight-lab-5d5a.jaerbi42.workers.dev';

  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 хвилин

  getTalismans(league?: string, ignoreCache: boolean = false): Observable<TalismanItem[]> {
    if (!isPlatformBrowser(this.platformId)) {
      return of([]);
    }

    const targetLeague = league || this.leagueState.selectedLeague();
    const cacheKey = `delvescout_talismans_cache_${targetLeague}_v1`;
    const cacheTimeKey = `delvescout_talismans_cache_time_${targetLeague}_v1`;

    const now = new Date().getTime();
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);

    if (!ignoreCache && cachedData && cachedTime && (now - Number(cachedTime) < this.CACHE_DURATION)) {
      try {
        const parsedArray: TalismanItem[] = JSON.parse(cachedData);
        if (parsedArray && parsedArray.length > 0) {
          return of(parsedArray);
        }
      } catch (e) {
        console.error(`Talismans cache read error for league ${targetLeague}:`, e);
      }
    }

    // Запит через твій воркер для типу BaseType
    const url = `${this.workerUrl}?league=${targetLeague}&type=BaseType`;

    return this.http.get<any>(url).pipe(
      catchError((err) => {
        console.error(`Error fetching Talismans for league ${targetLeague}:`, err);
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

        const bestByName = new Map<string, TalismanItem>();

        lines.forEach((line: any) => {
          const meta = metaMap.get(line.id) || {};
          const itemName = meta.name || line.name || '';
          const itemType = meta.itemType || line.itemType || '';
          const levelRequired = line.levelRequired ?? meta.levelRequired ?? 0;
          const variant = line.variant || meta.variant;

          // Фільтруємо за нашим списком, типом Amulet, ilvl >= 82 та без впливів
          if (
            TALISMAN_SET.has(itemName) &&
            itemType === 'Amulet' &&
            levelRequired >= 82 &&
            !variant
          ) {
            let iconUrl = meta.image || line.icon || '';
            if (iconUrl && iconUrl.startsWith('/')) {
              iconUrl = `https://web.poecdn.com${iconUrl}`;
            }

            const chaosValue = line.chaosValue ?? line.primaryValue ?? 0;
            const divineValue = line.divineValue ?? 0;

            const existing = bestByName.get(itemName);
            // Залишаємо варіант із найвищою ціною (актуальний ilvl)
            if (!existing || chaosValue > existing.chaosValue) {
              bestByName.set(itemName, {
                id: line.id || itemName,
                name: itemName,
                icon: iconUrl,
                chaosValue: chaosValue,
                divineValue: divineValue,
                levelRequired: levelRequired
              });
            }
          }
        });

        const result = Array.from(bestByName.values()).sort((a, b) => b.chaosValue - a.chaosValue);

        // Зберігаємо в localStorage
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
          localStorage.setItem(cacheTimeKey, now.toString());
        } catch (e) {
          console.error(`Talismans cache write error for league ${targetLeague}:`, e);
        }

        return result;
      })
    );
  }
}
