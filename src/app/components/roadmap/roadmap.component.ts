import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SettingsService } from '../../services/settings.service';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-roadmap',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
<div class="min-h-screen w-full bg-[#0a0c10] text-blue-100 font-sans selection:bg-blue-600/30 relative overflow-hidden flex flex-col items-center py-10">
     <div class="fixed inset-0 overflow-hidden pointer-events-none select-none z-0">
    <div class="floating-shape shape-giant-1"></div>
    <div class="floating-shape shape-giant-2"></div>
    <div class="floating-shape shape-giant-3"></div>
    <div class="floating-shape shape-giant-4"></div>
    <div class="floating-shape shape-giant-5"></div>
  </div>
  <svg width="0" height="0" class="absolute pointer-events-none">
    <defs>
      <clipPath id="soft-triangle" clipPathUnits="objectBoundingBox">
        <path
          d="M0.5 0.05 Q0.5 0 0.56 0.12 L0.92 0.85 Q0.98 0.98 0.85 0.98 L0.15 0.98 Q0.02 0.98 0.08 0.85 L0.44 0.12 Q0.5 0 0.5 0.05"
        />
      </clipPath>
    </defs>
  </svg>
    <div class="fixed inset-0 pointer-events-none opacity-20 z-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
    <div class="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-transparent via-blue-900/5 to-black"></div>

    <div class="w-full max-w-5xl px-6 relative z-10">
      
      <div class="mb-10 flex items-center justify-between border-b border-blue-500/20 pb-6">
        <div class="flex flex-col">
          <div class="flex items-center gap-3">
             <div class="w-2 h-6 bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
             <h1 class="text-4xl font-black tracking-tighter uppercase italic text-white">
                {{ settings.t('STRATEGIC_PLAN') }}
             </h1>
          </div>
          <p class="text-[10px] uppercase tracking-[0.5em] text-blue-400/60 mt-2 ml-5 font-bold">Future_Ops // Deployment_Schedule</p>
        </div>
        <a routerLink="/" class="hud-btn-alt group">
          <span class="mr-2 text-blue-400 group-hover:text-white transition-colors">«</span>
          {{ settings.currentLang() === 'uk' ? 'ПОВЕРНУТИСЬ ДО МАПИ' : 'RETURN TO MAP' }}
        </a>
      </div>

      <div class="grid md:grid-cols-2 gap-8">
        <div class="roadmap-card group border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden opacity-45">
            <div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 blur-2xl -mr-8 -mt-8"></div>

            <div class="card-header relative z-10">
                <span class="text-[11px] font-mono text-emerald-200/50 italic">REF: PROJECT_VOLUMETRIC</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                {{ settings.currentLang() === 'uk' ? 'Виконано' : 'Completed' }}
                </span>
            </div>

            <div class="flex items-start gap-4 mt-4 relative z-10">
                <div class="w-12 h-12 flex-shrink-0 bg-emerald-600/20 border border-emerald-500/60 rotate-45 flex items-center justify-center group-hover:rotate-180 transition-all duration-700 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <div class="-rotate-45 group-hover:-rotate-180 transition-all duration-700 text-xl">
                    {{ settings.currentLang() === 'uk' ? '✔️' : '✅' }}
                </div>
                </div>

                <div>
                <h3 class="text-lg font-bold text-emerald-50 leading-tight mb-2 opacity-80 decoration-emerald-500/30 line-through decoration-2">
                    {{ settings.currentLang() === 'uk' ? 'Еволюція Юнітів (Волюметричне Переосмислення)' : 'Unit Evolution (Volumetric Overhaul)' }}
                </h3>
                <p class="text-sm text-emerald-100/40 leading-relaxed italic">
                    {{ settings.currentLang() === 'uk' ? 'Перехід від 2D до 3D-стилізованих волюметричних моделей.' : 'Transitioning from 2D to 3D-styled volumetric tactical models.' }}
                </p>
                </div>
            </div>

            <div class="card-footer mt-4 pt-4 border-t border-emerald-500/10 flex justify-between items-center relative z-10">
                <span class="text-[9px] uppercase tracking-widest text-emerald-500/40 font-bold">System_Verified</span>
                <div class="flex gap-1">
                <div class="w-3 h-1 bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                <div class="w-3 h-1 bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                <div class="w-3 h-1 bg-emerald-500 shadow-[0_0_5px_#10b981]"></div>
                </div>
            </div>
        </div>

        <div class="roadmap-card group">
          <div class="card-header">
             <span class="text-[11px] font-mono text-blue-200/50 italic">REF: RESOURCE_IRON</span>
             <span class="status-tag status-concept">{{ settings.currentLang() === 'uk' ? 'Концепт' : 'In Concept' }}</span>
          </div>
          <div class="flex items-start gap-4 mt-4">
             <div class="w-12 h-12 flex-shrink-0 bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                <span>⛓️</span>
             </div>
             <div>
                <h3 class="text-lg font-bold text-white leading-tight mb-2">{{ settings.currentLang() === 'uk' ? 'Інтеграція Ресурсу (Залізо)' : 'Resource Integration (Iron)' }}</h3>
                <p class="text-sm text-blue-100/60 leading-relaxed italic">
                  {{ settings.currentLang() === 'uk' ? 'Введення вторинного ресурсу для покращень озброєння.' : 'Introduction of iron as a secondary resource for weapon upgrades.' }}
                </p>
             </div>
          </div>
          <div class="card-footer mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
             <span class="text-[9px] uppercase tracking-widest text-white/30">Priority_Beta</span>
             <div class="flex gap-1">
                <div class="w-3 h-1 bg-emerald-500"></div><div class="w-3 h-1 bg-emerald-500/20"></div><div class="w-3 h-1 bg-emerald-500/20"></div>
             </div>
          </div>
        </div>

        <div class="roadmap-card group md:col-span-2">
          <div class="card-header">
             <span class="text-[11px] font-mono text-blue-200/50 italic">REF: INFRA_SMITHY</span>
             <span class="status-tag status-research">{{ settings.currentLang() === 'uk' ? 'Дослідження' : 'Researching' }}</span>
          </div>
          <div class="flex items-start gap-6 mt-4">
             <div class="w-16 h-16 flex-shrink-0 bg-blue-600/20 border-2 border-blue-500/40 rounded-sm flex items-center justify-center relative overflow-hidden group-hover:border-blue-400 transition-colors">
                <div class="absolute inset-0 bg-blue-500/10 animate-pulse"></div>
                <span class="text-2xl relative z-10">⚒️</span>
             </div>
             <div>
                <h3 class="text-xl font-bold text-white leading-tight mb-2">{{ settings.currentLang() === 'uk' ? 'Інфраструктура (Кузня)' : 'Infrastructure (The Smithy)' }}</h3>
                <p class="text-sm text-blue-100/60 leading-relaxed italic max-w-2xl">
                  {{ settings.currentLang() === 'uk' ? 'Перша будівля. Центр усіх покращень юнітів на основі Заліза.' : 'First constructible building. The Smithy will be the hub for all Iron-based enhancements.' }}
                </p>
             </div>
          </div>
        </div>
      </div>

      <div class="mt-12 p-6 border border-blue-500/30 bg-blue-500/5 relative">
         <div class="absolute -top-3 left-6 px-3 bg-[#0a0c10] text-[10px] font-black text-blue-400 tracking-widest uppercase">Community_Intel</div>
         <p class="text-sm text-blue-100/80 italic font-mono leading-relaxed">
            {{ settings.currentLang() === 'uk' ? 'Очікується ввід Оператора... Діліться ідеями через Модуль Зворотного Зв’язку, щоб впливати на пріоритетність цих проектів.' : 'Waiting for Operator input... Share your ideas via the Feedback module.' }}
         </p>
      </div>
    </div>
</div>
  `,
    styleUrl: '../feedback/feedback.component.css'
})
export class RoadmapComponent {
    constructor(public settings: SettingsService) { }
}
