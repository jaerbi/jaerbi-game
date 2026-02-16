import { Component, Input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { SettingsService } from '../../services/settings.service';
import { Unit } from '../../models/unit.model';

@Component({
    selector: 'app-units',
    standalone: true,
    imports: [CommonModule],
    encapsulation: ViewEncapsulation.None,
    templateUrl: './units.component.html'
})
export class UnitsComponent {

    @Input({ required: true }) unit!: Unit;
    @Input() isTower: boolean = false;

    constructor(public gameEngine: GameEngineService, public settings: SettingsService) { }
}
