import { ChangeDetectorRef, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
import html2canvas from 'html2canvas';

@Component({
    selector: 'app-print',
    imports: [CommonModule, FormsModule, DragDropModule],
    templateUrl: 'print.component.html',
    styleUrl: 'print.component.css',
})
export class PrintComponent implements OnInit, OnDestroy {
    @ViewChild('printableBoundary') printableBoundary!: ElementRef<HTMLDivElement>;
    @ViewChild('dragImageRef') dragImageRef?: ElementRef<HTMLDivElement>;
    @ViewChild('dragTextRef') dragTextRef?: ElementRef<HTMLDivElement>;

    private _cdr = inject(ChangeDetectorRef);

    basePrice: number = 25;
    imageAddonPrice: number = 30;
    textAddonPrice: number = 15;

    printPrice: number = 0;
    textPrice: number = 0;

    selectedColor: string = '#ffffff';
    selectedImage: string = 'assets/images/white-tshirt-base.png';
    userImage: string | null = null;
    userText: string = '';
    textColor: string = '#000000';
    textFont: string = 'font-sans';
    activeTab: 'image' | 'text' = 'image';
    printSize: number = 80;
    printPosition: 'center' | 'top-left' | 'top-right' | 'bottom-center' = 'center';
    selectedSize: string | null = null;
    isSubmitted: boolean = false;
    dragPosition = { x: 0, y: 0 };
    giftWrapPrice: number = 3;
    isGiftWrapSelected: boolean = false;
    fomoTimerText: string = '02:00:00';
    private _timerIntervalId: any;
    printRotation: number = 0;

    clipartCategories = [
        {
            name: 'IT / Coding',
            items: [
                { name: 'Code', url: 'https://api.iconify.design/lucide:code.svg?color=%233b82f6' },
                { name: 'Terminal', url: 'https://api.iconify.design/lucide:terminal.svg?color=%2310b981' },
                { name: 'Database', url: 'https://api.iconify.design/lucide:database.svg?color=%23ef4444' },
                { name: 'Coffee', url: 'https://api.iconify.design/lucide:coffee.svg?color=%23f59e0b' }
            ]
        },
        {
            name: 'Gaming',
            items: [
                { name: 'Gamepad', url: 'https://api.iconify.design/lucide:gamepad-2.svg?color=%238b5cf6' },
                { name: 'Swords', url: 'https://api.iconify.design/lucide:swords.svg?color=%23f43f5e' },
                { name: 'Trophy', url: 'https://api.iconify.design/lucide:trophy.svg?color=%23eab308' }
            ]
        },
        {
            name: 'Anime & Minimal',
            items: [
                { name: 'Heart', url: 'https://api.iconify.design/lucide:heart.svg?color=%23ec4899' },
                { name: 'Sparkles', url: 'https://api.iconify.design/lucide:sparkles.svg?color=%23a855f7' },
                { name: 'Flame', url: 'https://api.iconify.design/lucide:flame.svg?color=%23f97316' }
            ]
        }
    ];
    sizes = [
        { name: 'S', description: 'Width 48cm / Length 68cm' },
        { name: 'M', description: 'Width 51cm / Length 70cm' },
        { name: 'L', description: 'Width 54cm / Length 73cm' },
        { name: 'XL', description: 'Width 57cm / Length 75cm' },
        { name: 'XXL', description: 'Width 60cm / Length 77cm' }
    ];

    colors = [
        { name: 'White', hex: '#ffffff', image: 'assets/images/white-tshirt-base.png' },
        { name: 'Black', hex: '#1a1a1a', image: 'assets/images/black-t-shirt.png' },
        { name: 'Royal Blue', hex: '#2563eb', image: 'assets/images/blue-t-shirt.png' },
        { name: 'Red', hex: '#dc2626', image: 'assets/images/red-t-shirt.png' },
        { name: 'Forest Green', hex: '#166534', image: 'assets/images/green-t-shirt.png' },
        { name: 'Yellow', hex: '#facc15', image: 'assets/images/yellow-t-shirt.png' },
        { name: 'Maroon', hex: '#441e00', image: 'assets/images/maroon-t-shirt.png' },
        { name: 'Orange', hex: '#e86d0f', image: 'assets/images/orange-t-shirt.png' }
    ];

    fonts = [
        { name: 'Sans', class: 'font-sans' },
        { name: 'Serif', class: 'font-serif' },
        { name: 'Mono', class: 'font-mono' }
    ];

    textColors = ['#000000', '#ffffff', '#ef4444', '#3b82f6', '#10b981', '#f59e0b'];

    positionClasses = {
        'center': 'items-center justify-center text-center',
        'top-left': 'items-start justify-start text-left',
        'top-right': 'items-start justify-end text-right',
        'bottom-center': 'items-end justify-center text-center'
    };

    ngOnInit() {
        this.startFomoTimer();
    }

    ngOnDestroy() {
        if (this._timerIntervalId) {
            clearInterval(this._timerIntervalId);
        }
    }

    selectClipart(url: string) {
        this.activeTab = 'image'; // Перемикаємо на таб зображення
        this.userImage = url;     // Підставляємо URL стікера як картинку принту
        this.printPrice = this.imageAddonPrice; // додаємо вартість за друк принту

        // Скидаємо позицію в центр, щоб відпрацював наш точний математичний розрахунок
        this.changePosition('center');
    }

    startFomoTimer() {
        // Зробимо красивий циклічний таймер, який ресетиться кожні 2 години для ефекту терміновості
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        let startTime = Date.now();

        this._timerIntervalId = setInterval(() => {
            const now = Date.now();
            const elapsed = (now - startTime) % twoHoursInMs;
            const remaining = twoHoursInMs - elapsed;

            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            this.fomoTimerText =
                `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            this._cdr.detectChanges();
        }, 1000);
    }

    async downloadDesign() {
        if (!this.printableBoundary) return;

        try {
            const element = this.printableBoundary.nativeElement;

            // Опції для html2canvas, щоб отримати максимальну якість для друку
            const options = {
                scale: 3, // Збільшуємо масштаб в 3 рази для високої роздільної здатності (щоб не було розмитих пікселів)
                useCORS: true, // Дозволяє завантажувати сторонні зображення (якщо юзер завантажив картинку по лінку)
                logging: false, // Вимикаємо зайві логи в консолі
                backgroundColor: '#ffffff' // Робимо фон білим (або null, якщо потрібен прозорий PNG)
            };

            // Тимчасово прибираємо штрихпунктирну рамку перед скріншотом, щоб вона не пішла в друк
            element.classList.remove('border', 'border-dashed', 'border-gray-300');

            // Генеруємо канвас
            const canvas = await html2canvas(element, options);

            // Повертаємо рамку назад для інтерфейсу користувача
            element.classList.add('border', 'border-dashed', 'border-gray-300');

            // Конвертуємо канвас в Data URL (PNG картинку)
            const dataUrl = canvas.toDataURL('image/png');

            // Створюємо фантомне посилання для скачування файлу
            const downloadLink = document.createElement('a');

            // Формуємо красиву назву файлу (наприклад: design-1717658400.png)
            const timestamp = Math.floor(Date.now() / 1000);
            downloadLink.download = `design-${timestamp}.png`;
            downloadLink.href = dataUrl;

            // Імітуємо клік для скачування та видаляємо елемент
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);

        } catch (error) {
            console.error('Error generating PDF/PNG design:', error);
            // Тут можна вивести якийсь Toast-нотифікатор про помилку
        }
    }

    selectColor(colorObj: { name: string, hex: string, image: string }) {
        this.selectedColor = colorObj.hex;
        this.selectedImage = colorObj.image;
    }

    onDragStart() {
        // event.source.reset();
    }
    changePosition(position: 'center' | 'top-left' | 'top-right' | 'bottom-center') {
        this.printPosition = position;

        // Даємо Angular мить на оновлення DOM
        setTimeout(() => {
            if (!this.printableBoundary) return;

            // Отримуємо розміри штрихпунктирної рамки
            const boundaryRect = this.printableBoundary.nativeElement.getBoundingClientRect();
            const B_Width = boundaryRect.width;
            const B_Height = boundaryRect.height;

            // Отримуємо активний елемент, який зараз рендериться (картинка або текст)
            const activeElement = this.activeTab === 'image'
                ? this.dragImageRef?.nativeElement
                : this.dragTextRef?.nativeElement;

            if (!activeElement) {
                this.dragPosition = { x: 0, y: 0 };
                return;
            }

            // Отримуємо поточні фізичні розміри самого принту (вони вже враховують printSize відсотки)
            const elementRect = activeElement.getBoundingClientRect();
            const E_Width = elementRect.width;
            const E_Height = elementRect.height;

            // Математичний розрахунок координат відносно лівого верхнього кута (0, 0)
            switch (position) {
                case 'top-left':
                    // Невеликий відступ у 8 пікселів від країв
                    this.dragPosition = { x: 8, y: 8 };
                    break;

                case 'top-right':
                    // Ширина рамки мінус ширина елемента мінус відступ
                    this.dragPosition = { x: B_Width - E_Width - 8, y: 8 };
                    break;

                case 'bottom-center':
                    // Центр по горизонталі, а по вертикалі — в самий низ мінус відступ
                    this.dragPosition = {
                        x: (B_Width - E_Width) / 2,
                        y: B_Height - E_Height - 8
                    };
                    break;

                case 'center':
                default:
                    // Ідеальний центр по обох осях
                    this.dragPosition = {
                        x: (B_Width - E_Width) / 2,
                        y: (B_Height - E_Height) / 2
                    };
                    break;
            }

            // Обов'язково кажемо Angular оновити view
            this._cdr.detectChanges();
        }, 50);
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
        this.textPrice = this.userText.trim().length > 0 ? this.textAddonPrice : 0;
    }

    get totalPrice(): number {
        let total = this.basePrice;

        if (this.activeTab === 'image' && this.userImage) {
            total += this.printPrice;
        }
        if (this.activeTab === 'text' && this.userText.trim().length > 0) {
            total += this.textPrice;
        }
        if (this.isGiftWrapSelected) {
            total += this.giftWrapPrice;
        }

        return total;
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

        alert(`T-shirt size ${this.selectedSize} added to cart! Amount: €${this.totalPrice}.00`);

        this.isSubmitted = false;
    }

    // Геттер для координат картинки залежно від обраної позиції кнопок
    get imageCoords() {
        switch (this.printPosition) {
            case 'top-left':
                return { left: '8px', top: '8px', transform: 'none' };
            case 'top-right':
                return { left: 'auto', right: '8px', top: '8px', transform: 'none' }; // якщо right, краще зробити через відступи:
            case 'bottom-center':
                return { left: '50%', top: 'auto', bottom: '8px', transform: 'translateX(-50%)' };
            case 'center':
            default:
                return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
        }
    }

    // Оскільки для right/bottom CDK теж може підглючувати, зробимо універсальні чисті відсотки:
    get textCoords() {
        return this.getImageOrTextCoords();
    }

    getImageOrTextCoords() {
        switch (this.printPosition) {
            case 'top-left':
                return { left: '0%', top: '0%', transform: 'none' };
            case 'top-right':
                // Ставимо left: 100% і зміщуємо сам елемент назад на його ширину через -100%
                return { left: '100%', top: '0%', transform: 'translateX(-100%)' };
            case 'bottom-center':
                return { left: '50%', top: '100%', transform: 'translate(-50%, -100%)' };
            case 'center':
            default:
                return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
        }
    }
}
