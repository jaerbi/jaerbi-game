import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-print',
    imports: [CommonModule, FormsModule],
    templateUrl: 'print.component.html',
})
export class PrintComponent {
    private _cdr = inject(ChangeDetectorRef);

    // Ціноутворення (в Євро)
    basePrice: number = 25;       // Базова ціна футболки
    imageAddonPrice: number = 30; // Вартість друку зображення
    textAddonPrice: number = 15;  // Вартість друку тексту

    // Динамічні ціни кастомізації
    printPrice: number = 0;
    textPrice: number = 0;

    // Початкові дані стану
    selectedColor: string = '#ffffff';
    userImage: string | null = null;
    userText: string = '';
    textColor: string = '#000000';
    textFont: string = 'font-sans';
    activeTab: 'image' | 'text' = 'image';
    printSize: number = 80;
    printPosition: 'center' | 'top-left' | 'top-right' | 'bottom-center' = 'center';
    selectedSize: string | null = null;
    isSubmitted: boolean = false;

    sizes = [
        { name: 'S', description: 'Width 48cm / Length 68cm' },
        { name: 'M', description: 'Width 51cm / Length 70cm' },
        { name: 'L', description: 'Width 54cm / Length 73cm' },
        { name: 'XL', description: 'Width 57cm / Length 75cm' },
        { name: 'XXL', description: 'Width 60cm / Length 77cm' }
    ];

    colors = [
        { name: 'White', hex: '#ffffff' },
        { name: 'Black', hex: '#1a1a1a' },
        { name: 'Royal Blue', hex: '#2563eb' },
        { name: 'Red', hex: '#dc2626' },
        { name: 'Forest Green', hex: '#166534' },
        { name: 'Yellow', hex: '#facc15' }
    ];

    fonts = [
        { name: 'Sans', class: 'font-sans' },
        { name: 'Serif', class: 'font-serif' },
        { name: 'Mono', class: 'font-mono' }
    ];

    textColors = ['#000000', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'];
    
    positionClasses = {
        'center': 'items-center justify-center text-center',
        'top-left': 'items-start justify-start text-left p-4',
        'top-right': 'items-start justify-end text-right p-4',
        'bottom-center': 'items-end justify-center text-center p-4'
    };

    selectColor(hex: string) {
        this.selectedColor = hex;
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;

        if (input.files && input.files[0]) {
            const file = input.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                this.userImage = e.target?.result as string;
                this.printPrice = this.imageAddonPrice; // 30 €
                this._cdr.detectChanges();
            };
            reader.readAsDataURL(file);
        }
    }

    removeImage() {
        this.userImage = null;
        this.printPrice = 0;
    }

    onTextChange() {
        // Якщо текст є — додаємо 15 €, якщо пустий рядок — 0
        this.textPrice = this.userText.trim().length > 0 ? this.textAddonPrice : 0;
    }

    // Розумний підрахунок суми залежно від обраного активного табу
    get totalPrice(): number {
        if (this.activeTab === 'image' && this.userImage) {
            return this.basePrice + this.printPrice;
        }
        if (this.activeTab === 'text' && this.userText.trim().length > 0) {
            return this.basePrice + this.textPrice;
        }
        return this.basePrice;
    }

    selectSize(sizeName: string) {
        this.selectedSize = sizeName;
    }

    addToCart() {
        this.isSubmitted = true;

        if (!this.selectedSize) {
            return;
        }

        const orderDetails = {
            color: this.selectedColor,
            size: this.selectedSize,
            printType: this.activeTab,
            printValue: this.activeTab === 'image' ? this.userImage : this.userText,
            printScale: this.printSize,
            printPos: this.printPosition,
            price: this.totalPrice,
            currency: 'EUR'
        };

        console.log('Товар успішно додано в кошик:', orderDetails);
        alert(`T-shirt size ${this.selectedSize} added to cart! Amount: €${this.totalPrice}.00`);

        this.isSubmitted = false;
    }
}
