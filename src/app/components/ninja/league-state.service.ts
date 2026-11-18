import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

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

    // 1. СПОЧАТКУ оголошуємо масив доступних ліг, щоб він існував
    readonly availableLeagues: LeagueOption[] = [
        { id: 'Covens', name: 'Covens' },
        { id: 'Standard', name: 'Standard' },
        { id: 'Hardcore Covens', name: 'Hardcore Covens' },
    ];

    // 2. ПОТІМ оголошуємо BehaviorSubject та сигнал, які спираються на цей масив
    private _leagueSubject = new BehaviorSubject<string>(this.getInitialLeague());
    private _supportSubject = new Subject<void>();
    readonly selectedLeague = signal<string>(this.getInitialLeague());

    getSupportChange$(): Observable<void> {
        return this._supportSubject.asObservable();
    }

    setSupportChange(): void {
        this._supportSubject.next();
    }

    private getInitialLeague(): string {
        if (isPlatformBrowser(this.platformId)) {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved && this.availableLeagues.some(l => l.id === saved)) {
                return saved;
            }
        }
        return this.availableLeagues[0].id; // Тепер тут точно є елемент з індексом 0
    }

    getLeagueChange$(): Observable<string> {
        return this._leagueSubject.asObservable().pipe(
            distinctUntilChanged()
        );
    }

    setLeague(leagueId: string) {
        if (this.availableLeagues.some(l => l.id === leagueId) && this.selectedLeague() !== leagueId) {
            this.selectedLeague.set(leagueId);
            this._leagueSubject.next(leagueId);
            if (isPlatformBrowser(this.platformId)) {
                localStorage.setItem(this.STORAGE_KEY, leagueId);
            }
        }
    }
}
