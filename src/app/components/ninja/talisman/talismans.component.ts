import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TalismanService, TalismanItem } from './talisman.service';
import { DelveDonateComponent } from '../donate/delve-donate.component';
import { LeagueStateService } from '../league-state.service';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-talismans',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, DelveDonateComponent],
    templateUrl: './talismans.component.html'
})
export class TalismansComponent implements OnInit, OnDestroy {
    private leagueStateService = inject(LeagueStateService);
    private talismanService = inject(TalismanService);

    readonly onDestroy$ = new Subject<void>();
    talismans = signal<TalismanItem[]>([]);
    loading = signal<boolean>(true);
    error = signal<string | null>(null);
    
    isDonateOpen = signal<boolean>(false);

    // Сигнал для пошуку
    searchQuery = signal<string>('');

    // Обчислюваний масив: фільтрує талісмани за пошуком у реальному часі
    filteredTalismans = computed(() => {
        const query = this.searchQuery().toLowerCase().trim();
        const list = this.talismans();
        if (!query) return list;
        return list.filter(item => item.name.toLowerCase().includes(query));
    });

    ngOnInit(): void {
        this.loadTalismans();
        this.leagueStateService.getSupportChange$()
                    .pipe(
                        takeUntil(this.onDestroy$)
                    )
                    .subscribe({
                        next: () => {
                            this.toggleDonateModal();
                        }
                    });
    }

    ngOnDestroy(): void {
        this.onDestroy$.next();
        this.onDestroy$.complete();
    }

    loadTalismans(): void {
        this.loading.set(true);
        this.error.set(null);

        this.talismanService.getTalismans().subscribe({
            next: (data) => {
                this.talismans.set(data);
                this.loading.set(false);
            },
            error: (err) => {
                console.error('Failed to load talismans', err);
                this.error.set('Failed to load data from poe.ninja');
                this.loading.set(false);
            }
        });
    }

    toggleDonateModal() {
        this.isDonateOpen.update(v => !v);
    }
}
