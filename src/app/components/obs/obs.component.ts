import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScoreService } from './obs.service';

@Component({
    selector: 'app-obs',
    imports: [CommonModule, FormsModule],
    templateUrl: 'obs.component.html',
    styleUrl: 'obs.component.css',
})
export class OBSComponent {
    constructor(private scoreService: ScoreService) { }

    async addPoint(type: 'wins' | 'draws' | 'losses') {
        // 1. Отримуємо актуальні дані з сервера
        const data = await this.scoreService.getLatestData();

        // 2. Оновлюємо
        data[type] += 1;

        // 3. Зберігаємо назад
        await this.scoreService.saveData(data);
    }

    async reset() {
        await this.scoreService.saveData({ wins: 0, draws: 0, losses: 0 });
    }
}
