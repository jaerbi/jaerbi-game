import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SettingsService } from '../../services/settings.service';
import { AppPrivacyPolicyComponent } from '../privacy-policy/privacy-policy.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [CommonModule, AppPrivacyPolicyComponent],
    templateUrl: 'landing-page.component.html',
    styleUrl: '../feedback/feedback.component.css',
})
export class LandingPageComponent {
    showPrivacy = false;
    showTrailer = false;
    showRules = false;
    trailerUrl: SafeResourceUrl | null = null;
    rulesGame: 'tactics' | 'defense' = 'tactics';
    mobileMenuOpen = false;
    showTacticsMenu = false;
    showDefenseMenu = false;
    constructor(private router: Router, public settings: SettingsService, private sanitizer: DomSanitizer) { }

    openPrivacy() {
        this.showPrivacy = true;
    }
    openExternalLink(url: string): void {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) {
            win.focus();
        }
    }
    navigateTo(route: string) {
        this.router.navigate([route]);
    }
    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
    }
    toggleTacticsMenu() {
        this.showTacticsMenu = !this.showTacticsMenu;
        if (this.showTacticsMenu) this.showDefenseMenu = false;
    }
    toggleDefenseMenu() {
        this.showDefenseMenu = !this.showDefenseMenu;
        if (this.showDefenseMenu) this.showTacticsMenu = false;
    }
    openTrailer(game: 'tactics' | 'defense') {
        const url = game === 'tactics'
            ? 'https://www.youtube.com/embed/PGAlWFIkaGA'
            : 'https://www.youtube.com/embed/CPCWZEyqpPk';
        this.trailerUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
        this.showTrailer = true;
    }
    openRules(game: 'tactics' | 'defense') {
        this.rulesGame = game;
        this.showRules = true;
    }
    closeModals() {
        this.showTrailer = false;
        this.showRules = false;
        this.trailerUrl = null;
    }
}
