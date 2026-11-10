import { Component, inject, signal, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DelveSearchService, DelveSearchItem } from './delve-search.service';

@Component({
    selector: 'app-delve-search',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: 'delve-search.component.html'
})
export class DelveSearchComponent {
    public searchService = inject(DelveSearchService);
    private elementRef = inject(ElementRef);

    searchQuery = signal<string>('');
    isOpen = signal<boolean>(false);
    selectedItem = signal<DelveSearchItem | null>(null);

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        if (!this.elementRef.nativeElement.contains(event.target)) {
            // Закриваємо лише випадаючий список варіантів, але НЕ чіпаємо обраний предмет
            this.isOpen.set(false);
        }
    }

    filteredItems = computed(() => {
        const query = this.searchQuery().toLowerCase().trim();
        const items = this.searchService.allItems();

        if (!query) {
            return items;
        }

        return items.filter(item => item.name.toLowerCase().includes(query));
    });

    onInputFocus() {
        // Відкриваємо список тільки якщо нічого не вибрано або користувач хоче змінити пошук
        if (!this.selectedItem()) {
            this.isOpen.set(true);
        }
    }

    onInputTextChange(value: string) {
        this.searchQuery.set(value);
        this.selectedItem.set(null); // Скидаємо вибір, якщо користувач почав друкувати наново
        this.isOpen.set(true);
    }

    selectItem(item: DelveSearchItem) {
        this.selectedItem.set(item);
        this.searchQuery.set(item.name);
        this.isOpen.set(false); // Ховаємо список варіантів, але залишаємо обраний item
    }

    clearSearch() {
        this.searchQuery.set('');
        this.selectedItem.set(null);
        this.isOpen.set(false);
    }
}
