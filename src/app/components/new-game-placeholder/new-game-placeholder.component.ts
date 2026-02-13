import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-game-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white overflow-hidden">
      <div class="text-center z-10">
        <div class="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-purple-500/30 animate-bounce">
          <svg class="w-12 h-12 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
        </div>
        <h1 class="text-5xl font-black mb-4 tracking-tighter bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          PROJECT: X
        </h1>
        <p class="text-slate-400 text-lg mb-12 max-w-md">
          This sector of the Gaming Hub is still under construction. Our engineers are working hard to bring you a new strategic experience.
        </p>
        <button 
          (click)="goBack()"
          class="px-8 py-3 bg-slate-900 border border-slate-700 rounded-full font-bold hover:bg-slate-800 hover:border-slate-600 transition-all flex items-center mx-auto"
        >
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          RETURN TO HUB
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class NewGamePlaceholderComponent {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/']);
  }
}
