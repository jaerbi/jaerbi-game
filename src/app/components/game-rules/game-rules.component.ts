import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-game-rules',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[960px] max-w-[95vw] mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold">Game Guide</h2>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-lg cursor-pointer"
            (click)="engine.closeRules()"
          >
            ✖
          </button>
        </div>

        <div class="grid grid-cols-1 gap-6 overflow-y-auto max-h-[70vh] pr-2">
          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Unit Evolution</div>
            <div class="text-sm text-gray-300 mb-2">Movement AP: T1 = 1 AP, T2 = 2 AP, T3 = 3 AP.</div>
            <div class="flex items-center gap-6">
              <div class="flex flex-col items-center gap-2">
                <div class="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">1</div>
                <div class="text-xs text-gray-300">1–4</div>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div class="w-12 h-12 bg-blue-500 text-white flex items-center justify-center font-bold" [style.clip-path]="'polygon(50% 0%, 0% 100%, 100% 100%)'">5</div>
                <div class="text-xs text-gray-300">5–20</div>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div class="w-12 h-12 bg-blue-500 text-white flex items-center justify-center font-bold">25</div>
                <div class="text-xs text-gray-300">25–100</div>
              </div>
              <div class="flex flex-col items-center gap-2">
                <div class="w-12 h-12 bg-blue-500 text-white flex items-center justify-center font-bold rotate-45 scale-75">125</div>
                <div class="text-xs text-gray-300">125–500</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Victory Conditions</div>
            <div class="text-sm text-gray-300">Win by Forest Monopoly (control all forests for 10 turns) or by destroying the enemy Base.</div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Forest Cycle</div>
            <div class="flex items-center gap-6">
              <div class="flex flex-col items-center">
                <div class="text-2xl">🌱</div>
                <div class="text-[11px] text-gray-400">Turn 1</div>
              </div>
              <div class="flex items-center text-gray-500">→</div>
              <div class="flex flex-col items-center">
                <div class="text-2xl">🌱</div>
                <div class="text-[11px] text-gray-400">Turn 2</div>
              </div>
              <div class="flex items-center text-gray-500">→</div>
              <div class="flex flex-col items-center">
                <div class="text-2xl">🌳</div>
                <div class="text-[11px] text-emerald-400">+2 Wood/turn</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Wall Legend</div>
            <div class="grid grid-cols-3 gap-4">
              <div class="flex items-center gap-2">
                <div class="h-4 w-16 rounded bg-lime-400"></div>
                <div class="text-xs text-gray-300">Player (10 Wood)</div>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-4 w-16 rounded bg-red-400"></div>
                <div class="text-xs text-gray-300">AI</div>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-4 w-16 rounded bg-gray-300"></div>
                <div class="text-xs text-gray-300">Neutral (3 hits)</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Combat (Animated)</div>
            <div class="grid grid-cols-2 gap-6">
              <div>
                <div class="text-sm font-semibold mb-2">Unit vs Unit</div>
                <div class="relative w-40 h-24 bg-gray-900/40 rounded-lg border border-gray-700 flex items-center justify-around px-3">
                  <div class="w-10 h-10 bg-blue-500 text-white flex items-center justify-center font-bold" [style.clip-path]="'polygon(50% 0%, 0% 100%, 100% 100%)'">2</div>
                  <div class="text-xl">→</div>
                  <div class="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold hit-flash">1</div>
                </div>
                <div class="text-[11px] text-gray-400 mt-2">Tier 2 attacks Tier 1; the defender flashes to indicate damage.</div>
              </div>
              <div>
                <div class="text-sm font-semibold mb-2">Siege (Wall & Base)</div>
                <div class="relative w-40 h-24 bg-gray-900/40 rounded-lg border border-gray-700 flex items-center justify-center gap-3 px-2">
                  <div class="w-8 h-8 rounded bg-gray-300"></div>
                  <div class="text-xl">→</div>
                  <div class="w-10 h-10 bg-red-500 text-white flex items-center justify-center font-bold">🏰</div>
                  <div class="absolute right-2 top-2 h-3 w-24 bg-red-900 rounded overflow-hidden">
                    <div class="h-3 bg-red-500 rounded hp-drain" style="width: 85%"></div>
                  </div>
                </div>
                <div class="text-[11px] text-gray-400 mt-2">Walls and Base lose HP under siege. The bar drains to show damage.</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Movement & Evolution</div>
            <div class="text-sm text-gray-300 mb-2">Higher Tiers grant more Movement AP per action:</div>
            <ul class="text-sm text-gray-300 list-disc ml-5 mb-3">
              <li>T1 = 1 AP</li>
              <li>T2 = 2 AP</li>
              <li>T3 = 3 AP</li>
            </ul>
            <div class="merge-loop mx-auto">
              <div class="unit u1">1</div>
              <div class="unit u2">1</div>
              <div class="result">2</div>
            </div>
            <div class="text-[11px] text-gray-400 mt-2">Two units merge into a higher tier; gaining stronger stats and roles.</div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Victory Conditions</div>
            <div class="text-sm text-gray-300">Two ways to win:</div>
            <ul class="text-sm text-gray-300 list-disc ml-5">
              <li>Monopoly: Capture and hold all 10 forests for 10 consecutive turns.</li>
              <li>Annihilation: Reduce the enemy Base HP to 0.</li>
            </ul>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">Merging (Animated)</div>
            <div class="merge-loop mx-auto">
              <div class="unit u1">1</div>
              <div class="unit u2">1</div>
              <div class="result">2</div>
            </div>
            <div class="text-[11px] text-gray-400 mt-2">Two T1 units combine into a stronger unit.</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class GameRulesComponent {
  constructor(public engine: GameEngineService, public settings: SettingsService) {}
}
