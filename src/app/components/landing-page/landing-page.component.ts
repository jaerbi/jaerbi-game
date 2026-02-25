import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { AppPrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [CommonModule, AppPrivacyPolicyComponent],
    templateUrl: 'landing-page.component.html',
    styles: [`
    :host {
      display: block;
    }
  `]
})
export class LandingPageComponent {
    showPrivacy = false;
    constructor(private router: Router, public settings: SettingsService,) { }

    openPrivacy() {
        this.showPrivacy = true;
    }
    navigateTo(route: string) {
        this.router.navigate([route]);
    }
}
