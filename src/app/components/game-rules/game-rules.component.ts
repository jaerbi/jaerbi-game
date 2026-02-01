import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-game-rules',
    standalone: true,
    imports: [CommonModule],
    encapsulation: ViewEncapsulation.None,
    styleUrl: './game-rules.component.css',
    templateUrl: './game-rules.component.html'
})
export class GameRulesComponent {
    constructor(public engine: GameEngineService, public settings: SettingsService) { }
}
