import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [CommonModule],
    templateUrl: 'landing-page.component.html',
    styles: [`
    :host {
      display: block;
    }
  `]
})
export class LandingPageComponent {
    constructor(private router: Router, public settings: SettingsService,) { }

    navigateTo(route: string) {
        this.router.navigate([route]);
    }
}
