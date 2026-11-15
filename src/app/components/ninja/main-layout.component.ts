import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { LeagueStateService } from './league-state.service';

@Component({
    selector: 'app-main-layout',
    standalone: true,
    imports: [CommonModule, RouterOutlet],
    templateUrl: './main-layout.component.html'
})
export class MainLayoutComponent {

    private leagueStateService = inject(LeagueStateService);
    
    toggleDonateModal(): void {
        this.leagueStateService.setSupportChange();
    }
}
