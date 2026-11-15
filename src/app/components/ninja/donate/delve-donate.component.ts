import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-delve-donate',
    standalone: true,
    imports: [CommonModule],
    templateUrl: 'delve-donate.component.html'
})
export class DelveDonateComponent {

    copySupportLink(url: string) {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url);
            }
        } catch { }
    }

    openExternalLink(url: string): void {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) {
            win.focus();
        }
    }
}

