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
  private static readonly BASIC_COST_MULTIPLIER = 5;
  private static readonly GOLDEN_COST = 150;

  private static readonly GOLDEN_MAX_LEVEL = 3;
  private static readonly GOLDEN_LEVEL_COSTS: Record<number, number> = {
    1: 50,
    2: 150,
    3: 400
  };

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
  isSaved = signal(false);

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

  getNextLevelCost(tierId: number, kind: 'damage' | 'range' | 'golden'): number {
    const current = this.getUpgradeLevel(tierId, kind);
    if (kind === 'golden') {
      const nextLevel = current + 1;
      if (nextLevel > MasteriesComponent.GOLDEN_MAX_LEVEL) return 0;
      return MasteriesComponent.GOLDEN_LEVEL_COSTS[nextLevel] ?? 0;
    }
    if (current >= 20) return 0;
    return (current + 1) * MasteriesComponent.BASIC_COST_MULTIPLIER;
  }

  canIncreaseBasic(tierId: number, kind: 'damage' | 'range'): boolean {
    const current = this.getUpgradeLevel(tierId, kind);
    if (current >= 20) return false;
    const cost = this.getNextLevelCost(tierId, kind);
    if (cost <= 0) return false;
    if (!this.profile()) return false;
    if (this.availablePoints() < cost) return false;
    return !!this.profile();
  }

  getGoldMasteryLevel(): number {
    const p = this.firebase.masteryProfile();
    if (!p || !p.upgrades) return 0;
    const v = p.upgrades['gold_mastery'];
    return typeof v === 'number' ? v : 0;
  }

  getGoldNextLevelCost(): number {
    const current = this.getGoldMasteryLevel();
    if (current >= 20) return 0;
    return (current + 1) * MasteriesComponent.BASIC_COST_MULTIPLIER;
  }

  canIncreaseGold(): boolean {
    const current = this.getGoldMasteryLevel();
    if (current >= 20) return false;
    if (!this.profile()) return false;
    const cost = this.getGoldNextLevelCost();
    if (cost <= 0) return false;
    if (this.availablePoints() < cost) return false;
    return true;
  }

  increaseGold() {
    if (!this.canIncreaseGold()) return;
    const cost = this.getGoldNextLevelCost();
    if (cost <= 0) return;
    this.updateProfile(p => {
      const current = typeof p.upgrades?.['gold_mastery'] === 'number' ? p.upgrades['gold_mastery'] : 0;
      const level = current + 1;
      const upgrades = { ...p.upgrades, gold_mastery: level };
      return {
        ...p,
        usedPoints: p.usedPoints + cost,
        upgrades
      };
    });
    this.isSaved.set(false);
  }

  private updateProfile(mutator: (p: MasteryProfile) => MasteryProfile) {
    const p = this.firebase.masteryProfile();
    if (!p) return;
    const next = mutator(p);
    this.firebase.setMasteryProfile(next);
  }

  increaseBasic(tierId: number, kind: 'damage' | 'range') {
    if (!this.canIncreaseBasic(tierId, kind)) return;
    const cost = this.getNextLevelCost(tierId, kind);
    if (cost <= 0) return;
    this.updateProfile(p => {
      const key = this.keyFor(tierId, kind);
      const current = p.upgrades?.[key] ?? 0;
      const upgrades = { ...p.upgrades, [key]: current + 1 };
      return {
        ...p,
        usedPoints: p.usedPoints + cost,
        upgrades
      };
    });
    this.isSaved.set(false);
  }

  canUnlockGolden(tierId: number): boolean {
    const dmg = this.getUpgradeLevel(tierId, 'damage');
    const rng = this.getUpgradeLevel(tierId, 'range');
    return dmg + rng >= 199;
  }

  canIncreaseGolden(tierId: number): boolean {
    if (!this.profile()) return false;
    if (!this.canUnlockGolden(tierId)) return false;
    const current = this.getUpgradeLevel(tierId, 'golden');
    if (current >= MasteriesComponent.GOLDEN_MAX_LEVEL) return false;
    const cost = this.getNextLevelCost(tierId, 'golden');
    if (this.availablePoints() < cost) return false;
    return true;
  }

  increaseGolden(tierId: number) {
    if (!this.canIncreaseGolden(tierId)) return;
    const cost = this.getNextLevelCost(tierId, 'golden');
    if (cost <= 0) return;
    this.updateProfile(p => {
      const key = this.keyFor(tierId, 'golden');
      const current = p.upgrades?.[key] ?? 0;
      const upgrades = { ...p.upgrades, [key]: current + 1 };
      return {
        ...p,
        usedPoints: p.usedPoints + cost,
        upgrades
      };
    });
    this.isSaved.set(false);
  }

  async save() {
    if (!this.profile()) return;
    this.saving.set(true);
    try {
      await this.firebase.saveTowerDefenseMasteries();
    } catch {
    } finally {
      this.saving.set(false);
      this.isSaved.set(true);
    }
  }

  login() {
    this.firebase.loginWithGoogle();
  }
}
