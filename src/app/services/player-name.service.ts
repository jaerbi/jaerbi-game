import { Injectable, inject, signal } from '@angular/core';
import { PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class PlayerNameService {
  private platformId = inject(PLATFORM_ID);
  private nameSignal = signal<string>('Player');

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const raw = localStorage.getItem('playerName');
        if (raw && typeof raw === 'string' && raw.trim().length > 0) {
          this.nameSignal.set(this.normalize(raw));
        }
      } catch {}
    }
  }

  name(): string {
    return this.nameSignal();
  }

  setName(name: string) {
    const normalized = this.normalize(name);
    this.nameSignal.set(normalized);
    if (isPlatformBrowser(this.platformId)) {
      try {
        localStorage.setItem('playerName', normalized);
      } catch {}
    }
  }

  private normalize(input: string): string {
    const trimmed = (input ?? '').toString().trim();
    const limited = trimmed.slice(0, 24);
    return limited.length > 0 ? limited : 'Player';
  }
}
