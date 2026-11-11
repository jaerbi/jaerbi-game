import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';

export interface LeagueOption {
    id: string;
    name: string;
}

@Injectable({
    providedIn: 'root'
})
export class LeagueStateService {
    private platformId = inject(PLATFORM_ID);
    private readonly STORAGE_KEY = 'delvescout_selected_league';

    private _leagueChange$ = new Subject<void>();
    private _setLeagueChange(): void { this._leagueChange$.next(); }
    public getLeagueChange$(): Observable<void> { return this._leagueChange$.asObservable();  }

    // 1. Список доступних ліг (перша у списку — дефолтна)
    readonly availableLeagues: LeagueOption[] = [
        { id: 'Standard', name: 'Standard' },
        { id: 'Allflame', name: 'Allflame' }
    ];

    // 2. Ініціалізація сигналу з localStorage або дефолтом (перша ліга)
    readonly selectedLeague = signal<string>(this.getInitialLeague());

    private getInitialLeague(): string {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            // Перевіряємо, чи збережена ліга є в нашому списку
            if (saved && this.availableLeagues.some(l => l.id === saved)) {
                return saved;
            }
        }
        return this.availableLeagues[0].id;
    }

    // Метод для зміни ліги з урахуванням localStorage
    setLeague(leagueId: string) {
        if (this.availableLeagues.some(l => l.id === leagueId)) {
            this.selectedLeague.set(leagueId);
            this._setLeagueChange();
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(this.STORAGE_KEY, leagueId);
            }
        }
    }
}
