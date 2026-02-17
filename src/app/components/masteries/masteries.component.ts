import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FirebaseService, MasteryProfile } from '../../services/firebase.service';
import { SettingsService } from '../../services/settings.service';
import { TranslationKey } from '../../i18n/translations';

interface TierMeta {
  id: number;
  nameKey: TranslationKey;
  color: string;
  goldenTitleKey: TranslationKey;
  goldenDescriptionKey: TranslationKey;
}

@Component({
  selector: 'app-masteries',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: 'masteries.component.html',
})
export class MasteriesComponent implements OnInit {
  tiers: TierMeta[] = [
    {
      id: 1,
      nameKey: 'T1_NAME',
      color: 'text-sky-400',
      goldenTitleKey: 'T1_GOLDEN_TITLE',
      goldenDescriptionKey: 'T1_GOLDEN_DESC'
    },
    {
      id: 2,
      nameKey: 'T2_NAME',
      color: 'text-purple-400',
      goldenTitleKey: 'T2_GOLDEN_TITLE',
      goldenDescriptionKey: 'T2_GOLDEN_DESC'
    },
    {
      id: 3,
      nameKey: 'T3_NAME',
      color: 'text-amber-400',
      goldenTitleKey: 'T3_GOLDEN_TITLE',
      goldenDescriptionKey: 'T3_GOLDEN_DESC'
    },
    {
      id: 4,
      nameKey: 'T4_NAME',
      color: 'text-rose-400',
      goldenTitleKey: 'T4_GOLDEN_TITLE',
      goldenDescriptionKey: 'T4_GOLDEN_DESC'
    }
  ];

  saving = signal(false);

  constructor(public firebase: FirebaseService, public settings: SettingsService) { }

  ngOnInit() { }

  user() {
    return this.firebase.user$();
  }

  profile() {
    return this.firebase.masteryProfile();
  }

  availablePoints() {
    const p = this.firebase.masteryProfile();
    if (!p) return 0;
    const v = p.totalXp - p.usedPoints;
    return v > 0 ? v : 0;
  }

  private keyFor(tierId: number, kind: 'damage' | 'range' | 'golden'): string {
    return `t${tierId}_${kind}`;
  }

  getUpgradeLevel(tierId: number, kind: 'damage' | 'range' | 'golden'): number {
    const p = this.firebase.masteryProfile();
    if (!p) return 0;
    const key = this.keyFor(tierId, kind);
    const v = p.upgrades?.[key];
    return typeof v === 'number' ? v : 0;
  }

  private canSpendPoint(): boolean {
    return this.availablePoints() > 0;
  }

  canIncreaseBasic(tierId: number, kind: 'damage' | 'range'): boolean {
    const current = this.getUpgradeLevel(tierId, kind);
    if (current >= 10) return false;
    if (!this.canSpendPoint()) return false;
    return !!this.profile();
  }

  private updateProfile(mutator: (p: MasteryProfile) => MasteryProfile) {
    const p = this.firebase.masteryProfile();
    if (!p) return;
    const next = mutator(p);
    this.firebase.setMasteryProfile(next);
  }

  increaseBasic(tierId: number, kind: 'damage' | 'range') {
    if (!this.canIncreaseBasic(tierId, kind)) return;
    this.updateProfile(p => {
      const key = this.keyFor(tierId, kind);
      const current = p.upgrades?.[key] ?? 0;
      const upgrades = { ...p.upgrades, [key]: current + 1 };
      return {
        ...p,
        usedPoints: p.usedPoints + 1,
        upgrades
      };
    });
  }

  canUnlockGolden(tierId: number): boolean {
    const dmg = this.getUpgradeLevel(tierId, 'damage');
    const rng = this.getUpgradeLevel(tierId, 'range');
    return dmg + rng >= 5;
  }

  canIncreaseGolden(tierId: number): boolean {
    if (!this.profile()) return false;
    if (!this.canSpendPoint()) return false;
    if (!this.canUnlockGolden(tierId)) return false;
    const current = this.getUpgradeLevel(tierId, 'golden');
    if (current >= 1) return false;
    return true;
  }

  increaseGolden(tierId: number) {
    if (!this.canIncreaseGolden(tierId)) return;
    this.updateProfile(p => {
      const key = this.keyFor(tierId, 'golden');
      const current = p.upgrades?.[key] ?? 0;
      const upgrades = { ...p.upgrades, [key]: current + 1 };
      return {
        ...p,
        usedPoints: p.usedPoints + 1,
        upgrades
      };
    });
  }

  async save() {
    if (!this.profile()) return;
    this.saving.set(true);
    try {
      await this.firebase.saveTowerDefenseMasteries();
    } catch {
    } finally {
      this.saving.set(false);
    }
  }

  login() {
    this.firebase.loginWithGoogle();
  }
}

