import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngineService } from '../../services/game-engine.service';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-support-community',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div class="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[880px] max-w-[95vw] mx-4 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-bold text-white">{{ settings.t('SUPPORT_COMMUNITY') }}</h2>
          <button
            class="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-gray-600 text-white text-lg cursor-pointer"
            (click)="gameEngine.closeSupport()"
          >
            ✖
          </button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3 text-white">Donate</div>
            <div class="text-sm text-gray-300 mb-2 font-medium">{{ settings.t('MONOBANK_JAR') }}</div>
            
            <div class="flex items-start gap-4">
              <div class="w-32 h-32 bg-white rounded-lg p-2 border border-gray-300 flex items-center justify-center shrink-0">
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://send.monobank.ua/jar/2fqGoPhV7G" 
                  alt="QR Code"
                  class="w-full h-full"
                  referrerpolicy="no-referrer"
                />
              </div>
              
              <div class="flex-1">
                <div class="text-[10px] text-gray-400 mb-2 break-all font-mono">send.monobank.ua/jar/2fqGoPhV7G</div>
                <div class="flex flex-col gap-2">
                  <button
                    class="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold cursor-pointer transition-colors"
                    (click)="openExternalLink('https://send.monobank.ua/jar/2fqGoPhV7G')"
                  >
                    {{ settings.t('OPEN_LINK') }} 📜
                  </button>
                  <button
                    class="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm cursor-pointer transition-colors"
                    (click)="gameEngine.copySupportLink('https://send.monobank.ua/jar/2fqGoPhV7G')"
                  >
                    {{ settings.t('COPY_LINK') }} 📋
                  </button>
                </div>
              </div>
            </div>
            
            <div class="mt-6 border-t border-gray-700 pt-4">
              <div class="text-sm text-gray-300 mb-2 font-medium">Donatello</div>
              <button
                class="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer transition-colors"
                (click)="openExternalLink('https://donatello.to/jaerbi')"
              >
                Go to Donatello.to 💎
              </button>
            </div>
            <div class="text-xs text-emerald-400 mt-4 font-medium italic">{{ settings.t('THANK_SUPPORTING') }}</div>
          </div>

          <div class="bg-gray-800/60 border border-gray-700 rounded-lg p-4">
            <div class="text-lg font-semibold mb-3 text-white">{{ settings.t('SOCIAL_FEEDBACK') }}</div>
            <div class="flex flex-col gap-3">
              <button
                class="flex items-center justify-start gap-3 px-4 py-3 rounded-lg bg-[#5865F2] hover:brightness-110 text-white text-sm font-bold cursor-pointer transition-all"
                (click)="openExternalLink('https://discord.gg/c9tCWFtFaG')"
              >
                <span class="text-xl">🗨️</span>
                <div class="text-left">
                  <div class="leading-none">Discord Server</div>
                  <div class="text-[10px] font-normal opacity-80 mt-1">Share ideas & feedback</div>
                </div>
              </button>
              
              <button
                class="flex items-center justify-start gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold cursor-pointer transition-all"
                (click)="openExternalLink('https://www.youtube.com/@jaerb1')"
              >
                <span class="text-xl">▶️</span>
                <div class="text-left">
                  <div class="leading-none">YouTube</div>
                  <div class="text-[10px] font-normal opacity-80 mt-1">Dev logs & gameplay</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SupportCommunityComponent {
    constructor(public gameEngine: GameEngineService, public settings: SettingsService,) { }

    openExternalLink(url: string): void {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) {
            win.focus();
        }
    }
}
