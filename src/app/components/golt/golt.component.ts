import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule } from '@angular/cdk/drag-drop';
interface EstimateItem {
  module: string;
  description: string;
  hoursMin: number;
  hoursMax: number;
}
@Component({
    selector: 'app-golt',
    imports: [CommonModule, FormsModule, DragDropModule],
    templateUrl: 'golt.component.html',
    styleUrl: 'golt.component.css',
})
export class GoltComponent {
    projectName = 'Golt Platform';
    estimateData: EstimateItem[] = [
        {
            module: '1. Project Setup & Architecture',
            description: 'Ініціалізація проекту, налаштування CI/CD, базовий UI Kit, State Management, загальний роутинг.',
            hoursMin: 16,
            hoursMax: 30
        },
        {
            module: '2. Credit Application Flow',
            description: '9 кроків клієнтської анкети, валідація, логіка "Resume application", динамічна генерація сторінок під API кредиторів.',
            hoursMin: 60,
            hoursMax: 80
        },
        {
            module: '3. Admin Portal: Core & Users',
            description: 'Авторизація, рольова модель (RBAC - Admin, Operator, Viewer), базовий лейаут, менеджмент користувачів.',
            hoursMin: 16,
            hoursMax: 30
        },
        {
            module: '4. Admin Portal: Applications',
            description: 'Списки заявок, пошук/фільтри, детальний Audit Log зі стрічкою подій, ручне створення та редагування.',
            hoursMin: 24,
            hoursMax: 40
        },
        {
            module: '5. Admin Portal: Lenders & Merchants',
            description: 'CRUD операції для кредиторів та мерчантів, активація/деактивація програм, складний інтерфейс Field Mapping.',
            hoursMin: 48,
            hoursMax: 70
        },
        {
            module: '6. Admin Portal: Routing Center',
            description: 'Інтерфейс налаштування пріоритетів (Drag-and-Drop), симулятор роутингу без відправки реальних даних, логи помилок.',
            hoursMin: 20,
            hoursMax: 30
        },
        {
            module: '7. Admin Portal: Financials',
            description: 'Таблиці транзакцій, оновлення статусів через API/Webhooks, механізм Refund для Settled угод.',
            hoursMin: 16,
            hoursMax: 30
        },
        {
            module: '8. Merchant Portal',
            description: 'Авторизація, кастомні списки заявок мерчанта, керування доступними кредитними програмами, менеджмент локальних користувачів.',
            hoursMin: 40,
            hoursMax: 60
        },
        {
            module: '9. Integration & Polishing',
            description: 'Зв\'язка з бекенд API, глобальний Error Handling, адаптивна верстка форми, фінальний багфікс.',
            hoursMin: 40,
            hoursMax: 60
        }
    ];

    totalMin = 0;
    totalMax = 0;

    ngOnInit(): void {
        this.calculateTotals();
    }

    private calculateTotals(): void {
        this.totalMin = this.estimateData.reduce((sum, item) => sum + item.hoursMin, 0);
        this.totalMax = this.estimateData.reduce((sum, item) => sum + item.hoursMax, 0);
    }
}
