import { Component, OnInit, inject, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PoeNinjaService, NinjaItem } from './poe-ninja.service';

@Component({
    selector: 'app-poe-tracker',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div class="max-w-6xl mx-auto space-y-6">
        
        <!-- Header & Controls -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
          <div>
            <h1 class="text-2xl font-bold text-amber-400">PoE Price Tracker</h1>
            <p class="text-xs text-slate-400">Моніторинг стрімких змін цін poe.ninja</p>
          </div>

          <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <!-- Search -->
            <input 
                type="text" 
                placeholder="Пошук предмета..." 
                [(ngModel)]="searchQuery"
                class="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-400 w-full md:w-48"
                />
            <!-- Filter Buttons -->
            <div class="flex bg-slate-900 p-1 rounded-lg border border-slate-700 text-xs">
                <div class="flex gap-2">
                    <button (click)="loadData('Currency')" [class.bg-amber-600]="currentType() === 'Currency'" class="px-3 py-1 rounded bg-slate-800 text-xs">Валюта</button>
                    <button (click)="loadData('Fossil')" [class.bg-amber-600]="currentType() === 'Fossil'" class="px-3 py-1 rounded bg-slate-800 text-xs">Фосилі</button>
                </div>
              <button 
                (click)="activeFilter.set('all')"
                [class.bg-slate-700]="activeFilter() === 'all'"
                class="px-3 py-1.5 rounded-md font-medium transition"
              >Всі</button>
              <button 
                (click)="activeFilter.set('gainers')"
                [class.bg-emerald-900]="activeFilter() === 'gainers'"
                [class.text-emerald-300]="activeFilter() === 'gainers'"
                class="px-3 py-1.5 rounded-md font-medium transition hover:text-emerald-400"
              >🚀 Топ Росту</button>
              <button 
                (click)="activeFilter.set('losers')"
                [class.bg-rose-900]="activeFilter() === 'losers'"
                [class.text-rose-300]="activeFilter() === 'losers'"
                class="px-3 py-1.5 rounded-md font-medium transition hover:text-rose-400"
              >📉 Топ Падіння</button>
            </div>
          </div>
        </div>

        <!-- Table -->
        <div class="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
          @if (loading()) {
            <div class="p-12 text-center text-slate-400 animate-pulse">
              Завантаження та аналіз трендів з poe.ninja...
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-950/50 text-slate-400 text-xs uppercase border-b border-slate-700">
                    <th class="p-4">Предмет</th>
                    <th class="p-4 text-right">Поточна ціна</th>
                    <th class="p-4 text-right">Зміна (Тренд)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-700/50 text-sm">
                  @for (item of filteredItems(); track item.id) {
                    <tr class="hover:bg-slate-700/30 transition">
                      <!-- Item Icon & Name -->
                      <td class="p-4 flex items-center gap-3">
                        <img [src]="item.icon" [alt]="item.name" class="w-8 h-8 object-contain" />
                        <span class="font-medium text-slate-200">{{ item.name }}</span>
                      </td>

                      <!-- Price -->
                      <td class="p-4 text-right font-mono text-amber-300 font-semibold">
                        {{ item.chaosValue | number:'1.0-1' }} <span class="text-xs text-slate-400">c</span>
                      </td>

                      <!-- Change Percent -->
                      <td class="p-4 text-right font-mono font-bold">
                        <span 
                          [class.text-emerald-400]="item.changePercent > 0"
                          [class.text-rose-400]="item.changePercent < 0"
                          [class.text-slate-400]="item.changePercent === 0"
                          class="inline-flex items-center gap-1 bg-slate-900/60 px-2.5 py-1 rounded-md"
                        >
                          @if (item.changePercent > 0) { ▲ }
                          @if (item.changePercent < 0) { ▼ }
                          {{ item.changePercent > 0 ? '+' : '' }}{{ item.changePercent }}%
                        </span>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="3" class="p-8 text-center text-slate-400">Нічого не знайдено</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

      </div>
    </div>
  `
})
export class PoeTrackerComponent implements OnInit {
    private poeService = inject(PoeNinjaService);
    private platformId = inject(PLATFORM_ID);

    items = signal<NinjaItem[]>([]);
    loading = signal<boolean>(true);
    searchQuery = signal<string>('');
    activeFilter = signal<'all' | 'gainers' | 'losers'>('all');

    private readonly CACHE_KEY = 'poe_ninja_items_cache';
    private readonly CACHE_TIME_KEY = 'poe_ninja_cache_time';
    private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 хвилин

    filteredItems = computed(() => {
        let list = this.items();

        // 1. Пошук
        const query = this.searchQuery().toLowerCase().trim();
        if (query) {
            list = list.filter(item => item.name.toLowerCase().includes(query));
        }

        // 2. Фільтрація та сортування
        if (this.activeFilter() === 'gainers') {
            return [...list].filter(i => i.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent);
        }
        if (this.activeFilter() === 'losers') {
            return [...list].filter(i => i.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent);
        }

        return list;
    });

    currentType = signal<string>('Currency');

    loadData(type: string = this.currentType()) {
        this.loading.set(true);
        this.currentType.set(type);

        this.poeService.getItems('Allflame', type).subscribe({
            next: (data) => {
                this.items.set(data);
                this.loading.set(false);
            },
            error: () => this.loading.set(false)
        });
    }

    ngOnInit() {
        if (!isPlatformBrowser(this.platformId)) {
            this.loading.set(false);
            return;
        }

        // Перевіряємо кеш у localStorage
        const cachedData = localStorage.getItem(this.CACHE_KEY);
        const cachedTime = localStorage.getItem(this.CACHE_TIME_KEY);
        const now = new Date().getTime();

        if (cachedData && cachedTime && (now - Number(cachedTime) < this.CACHE_DURATION)) {
            try {
                const parsed = JSON.parse(cachedData);
                if (parsed && parsed.length > 0) {
                    this.items.set(parsed);
                    this.loading.set(false);
                    return; // Виходимо, бо використали свіжий кеш
                }
            } catch (e) {
                console.error('Помилка читання кешу:', e);
            }
        }

        // Якщо кешу немає або він застарів — робимо запит через сервіс
        this.poeService.getItems('Allflame').subscribe({
            next: (data) => {
                this.items.set(data);
                this.loading.set(false);

                // Зберігаємо у localStorage
                if (data && data.length > 0) {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify(data));
                    localStorage.setItem(this.CACHE_TIME_KEY, now.toString());
                }
            },
            error: (err) => {
                console.error('Помилка завантаження даних poe.ninja:', err);

                // Якщо сталася помилка мережі, але є старий кеш — спробуємо показати його як fallback
                if (cachedData) {
                    try {
                        this.items.set(JSON.parse(cachedData));
                    } catch (e) { /* ignore */ }
                }

                this.loading.set(false);
            }
        });
    }
}
