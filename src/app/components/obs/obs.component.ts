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

    addPoint(type: 'wins' | 'draws' | 'losses') {
        const data = this.scoreService.getData(); // Отримуємо актуальне
        data[type] += 1; // Додаємо +1
        this.scoreService.saveData(data); // Зберігаємо
    }
    reset() {
        this.scoreService.saveData({ wins: 0, draws: 0, losses: 0 });
    }
}
