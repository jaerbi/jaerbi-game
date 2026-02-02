import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-sandbox',
    standalone: true,
    imports: [CommonModule],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './sandbox.component.html'
})
export class SandboxComponent {

    constructor(public gameEngine: GameEngineService, public settings: SettingsService) { }
}
