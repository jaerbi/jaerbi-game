import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-game-rules',
    standalone: true,
    imports: [CommonModule],
    encapsulation: ViewEncapsulation.None,
    styleUrl: './game-rules.component.css',
    template: `
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[960px] max-w-[95vw] mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <h2 class="text-2xl font-bold">{{ settings.t('GAME_GUIDE') }}</h2>
                <h3 class="text-xs mt-2 font-bold text-gray-300">{{ settings.t('TURN_BASED_STRATEGY') }}</h3>
            </div>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-lg cursor-pointer"
            (click)="engine.closeRules()"
          >
            ✖
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto max-h-[80vh] pr-2">
          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4 md:col-span-2">
            <div class="text-lg font-semibold mb-3">{{ settings.t('VICTORY_CONDITIONS') }}</div>
            <div class="grid grid-cols-2 gap-6">
              <div class="flex items-center gap-3">
                <div class="text-3xl">🌳</div>
                <div>
                  <div class="text-sm font-semibold">{{ settings.t('MONOPOLY_LABEL') }}</div>
                  <div class="text-xs text-gray-400">{{ settings.t('MONOPOLY_DESC') }}</div>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-3xl">🏰</div>
                <div>
                  <div class="text-sm font-semibold">{{ settings.t('ANNIHILATION') }}</div>
                  <div class="text-xs text-gray-400">{{ settings.t('ANNIHILATION_DESC') }}</div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3">{{ settings.t('UNIT_EVOLUTION') }}</div>
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
                <div class="w-12 h-12 bg-blue-500 text-white flex items-center justify-center font-bold rotate-45 scale-75">
                    <span class="rotate-315">125</span>
                </div>
                <div class="text-xs text-gray-300">125–500</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-1">{{ settings.t('EVOLUTION') }}</div>
            <div class="text-sm text-gray-300 mb-3">{{ settings.t('EVOLUTION_DESC') }}</div>
            <div class="flex items-center justify-center h-[40px]">
              <div class="merge-loop relative">
                <div class="unit u1">2</div>
                <div class="unit u2">3</div>
                <div class="result">1</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4 md:col-span-2">
            <div class="text-lg font-semibold mb-3">{{ settings.t('COMBAT_DEEP_DIVE') }}</div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div class="text-sm font-semibold mb-2">{{ settings.t('SUCCESSFUL_ATTACK') }}</div>
                <div class="combat-stage">
                  <div class="attacker triangle">1</div>
                  <div class="defender circle hit-flash defender-fade">1</div>
                </div>
                <div class="text-[11px] text-gray-400 mt-2">{{ settings.t('SUCCESSFUL_ATTACK_DESC') }}</div>
              </div>
              <div>
                <div class="text-sm font-semibold mb-2">{{ settings.t('CRITICAL_HIT') }}</div>
                <div class="combat-stage">
                  <div class="attacker triangle">4</div>
                  <div class="defender square hit-flash defender-fade">1</div>
                  <span class="crit-pop">CRIT!</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-2">{{ settings.t('CRITICAL_HIT_DESC') }}</div>
              </div>
              <div>
                <div class="text-sm font-semibold mb-2">{{ settings.t('MISS') }}</div>
                <div class="combat-stage">
                  <div class="attacker triangle">1</div>
                  <div class="defender circle">4</div>
                  <span class="miss-pop">MISS!</span>
                </div>
                <div class="text-[11px] text-gray-400 mt-2">{{ settings.t('MISS_DESC') }}</div>
              </div>
            </div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-1">{{ settings.t('MOVEMENT') }}</div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <div class="text-xs text-gray-300 mb-1">{{ settings.t('T1_1_TILE') }}</div>
                <div class="path-grid" style="--start-x:2; --start-y:2; --line-steps:1;">
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell active"></div><div class="path-cell active"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="mover circle t1-path">2</div>
                  <div class="path-line path-animation"></div>
                  <div class="castle" [style.left.px]="6" [style.top.px]="6">🏰</div>
                </div>
              </div>
              <div>
                <div class="text-xs text-gray-300 mb-1">{{ settings.t('T3_3_TILES') }}</div>
                <div class="path-grid" style="--start-x:2; --start-y:2; --line-steps:2;">
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell active"></div><div class="path-cell active"></div><div class="path-cell active"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div><div class="path-cell"></div>
                  <div class="mover square t3-path">3</div>
                  <div class="path-line path-animation"></div>
                  <div class="castle red" [style.right.px]="6" [style.bottom.px]="6">🏰</div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col justify-between">
            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
              <div class="text-lg font-semibold mb-3">{{ settings.t('FOREST_CYCLE') }}</div>
              <div class="flex items-center gap-6">
                <div class="flex flex-col items-center">
                  <div class="text-2xl">🌱</div>
                  <div class="text-[11px] text-gray-400">{{ settings.t('TURN_1') }}</div>
                </div>
                <div class="flex items-center text-gray-500">→</div>
                <div class="flex flex-col items-center">
                  <div class="text-2xl">🌿</div>
                  <div class="text-[11px] text-gray-400">{{ settings.t('TURN_2') }}</div>
                </div>
                <div class="flex items-center text-gray-500">→</div>
                <div class="flex flex-col items-center">
                  <div class="text-2xl">🌳</div>
                  <div class="text-[11px] text-emerald-400">{{ settings.t('PLUS_8_WOOD_PER_TURN') }}</div>
                </div>
              </div>
            </div>

            <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-4">{{ settings.t('WALL_LEGEND') }}</div>
              <div class="grid grid-cols-3 gap-4 mb-1">
                <div class="flex items-center gap-2">
                  <div class="h-4 w-16 rounded bg-lime-400"></div>
                  <div class="text-xs text-gray-300">{{ settings.t('PLAYER') }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="h-4 w-16 rounded bg-red-400"></div>
                  <div class="text-xs text-gray-300">{{ settings.t('AI_FACTION') }}</div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="h-4 w-16 rounded bg-gray-300"></div>
                  <div class="text-xs text-gray-300">Neutral</div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `
})
export class GameRulesComponent {
    constructor(public engine: GameEngineService, public settings: SettingsService) { }
}
