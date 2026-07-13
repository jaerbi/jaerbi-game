import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScoreService } from './obs.service';

@Component({
    selector: 'app-score-overlay',
    imports: [CommonModule],
    templateUrl: 'score-overlay.component.html',
    styleUrl: 'score-overlay.component.css',
})
export class ScoreOverlayComponent implements OnInit {
    score = { wins: 0, draws: 0, losses: 0 };

    constructor(private scoreService: ScoreService) { }

    ngOnInit() {
        this.updateLocalData();
        // Слухаємо оновлення з адмінки
        window.addEventListener('storage', () => this.updateLocalData());
    }

    updateLocalData() {
        this.score = this.scoreService.getData();
    }
}
