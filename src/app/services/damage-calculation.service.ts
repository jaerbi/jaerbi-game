import { Injectable } from '@angular/core';
import { Enemy, InfernoZone, Position, Projectile, Tower } from '../models/unit.model';
import { WaveAnalyticsService } from './wave-analytics.service';

@Injectable({
    providedIn: 'root'
})
export class DamageCalculationService {
    // ========================================================================
    // SINGLE SOURCE OF TRUTH: BALANCE CONSTANTS
    // ========================================================================
    readonly RESISTANCE_MULTIPLIER = 0.25; // 75% Reduction
    readonly BOSS_RESISTANCE_MULTIPLIER = 0.3; // 70% Resistance
    
    // Frost
    readonly FROST_SLOW_BASE = 0.30;
    readonly FROST_SLOW_PER_LEVEL = 0.06;
    readonly FROST_AURA_RADIUS_BASE = 2;
    
    // Venom
    readonly VENOM_DURATION = 4;
    readonly VENOM_MAX_STACKS = 3;
    readonly VENOM_SLOW_MODIFIER = 0.8;
    
    // Prism
    readonly PRISM_RAMP_MAX_BONUS = 1;
    readonly PRISM_RAMP_MAX_BONUS_GOLDEN = 3;
    readonly PRISM_VULNERABILITY_BONUS = 1.15;

    // Golden Bonuses (% Current HP)
    readonly LIGHTNING_GOLDEN_PERCENT = 0.01;
    readonly SNIPER_GOLDEN_PERCENT = 0.02;

    constructor(private waveAnalytics: WaveAnalyticsService) {}

    /**
     * Calculates the raw damage a tower deals to a target, applying modifiers.
     * Updates tower state (Prism beam) and enemy state (Cannon stacks).
     */
    calculateTowerDamage(
        tower: Tower, 
        target: Enemy, 
        getUpgradeLevel: (tier: number, type: 'damage' | 'range' | 'golden') => number
    ): number {
        let damage = tower.damage;

        // 4. Sniper Execute (Special)
        if (tower.specialActive && tower.type === 4) {
            const ratio = target.hp / target.maxHp;
            if (ratio < 0.5) {
                const multiplier = target.isBoss ? 3 : 2;
                damage = Math.floor(damage * multiplier);
            }
        }

        // 3. Cannon Shatter (Special)
        if (tower.specialActive && tower.type === 3) {
            const nextStacks = Math.min(5, (target.shatterStacks || 0) + 1);
            target.shatterStacks = nextStacks;
            const multiplier = 1 + nextStacks * 0.2;
            damage = Math.floor(damage * multiplier);
        }

        // 6. Prism Ramp
        if (tower.type === 6) {
            const sameTarget = tower.lastBeamTargetId === target.id;
            const prevTime = tower.beamTime ?? 0;
            const newTime = sameTarget ? prevTime + tower.fireInterval : tower.fireInterval;
            tower.beamTime = newTime;
            tower.lastBeamTargetId = target.id;
            
            const golden = getUpgradeLevel(6, 'golden');
            const maxBonus = golden > 0 ? this.PRISM_RAMP_MAX_BONUS_GOLDEN : this.PRISM_RAMP_MAX_BONUS;
            const ramp = 1 + Math.min(maxBonus, newTime * 0.5);
            damage = Math.floor(damage * ramp);
        }

        // Prism Vulnerability Debuff
        if (target.prismVulnerableTime && target.prismVulnerableTime > 0) {
            damage = Math.floor(damage * this.PRISM_VULNERABILITY_BONUS);
        }

        // Golden Upgrades (% HP Damage)
        if (tower.type === 2) { // Lightning
            const golden = getUpgradeLevel(2, 'golden');
            const bonus = target.hp * (0.01 + golden * this.LIGHTNING_GOLDEN_PERCENT);
            damage += bonus;
        } else if (tower.type === 4) { // Sniper
            const golden = getUpgradeLevel(4, 'golden');
            const bonus = target.hp * (0.05 + golden * this.SNIPER_GOLDEN_PERCENT);
            damage += bonus;
        }

        return damage;
    }

    /**
     * Applies final damage to enemy, considering resistances.
     * Returns the actual damage amount dealt.
     */
    applyDamage(
        enemy: Enemy, 
        amount: number, 
        towerType: number, 
        currentWave: number,
        sourceTowerId?: string,
        recordStats?: (id: string, amount: number) => void
    ): number {
        let dmg = amount;

        // Counter Strategy Resistance (Wave 10+)
        if (currentWave >= 10) {
            if (this.waveAnalytics.isResistant(enemy, towerType)) {
                // Scaling Resistance based on Dominance Ratio
                // If ratio > 0.9 (90% dominance), apply 90% reduction (multiplier 0.1)
                // Otherwise apply standard 75% reduction (multiplier 0.25)
                const dominance = this.waveAnalytics.currentDominanceRatio || 0;
                const multiplier = dominance > 0.9 ? 0.1 : this.RESISTANCE_MULTIPLIER;
                
                dmg = Math.floor(dmg * multiplier);
            }
        }

        // Boss Resistances
        if (enemy.isBoss) {
            dmg = Math.floor(dmg * this.BOSS_RESISTANCE_MULTIPLIER);
        }

        enemy.hp -= dmg;

        if (sourceTowerId && recordStats) {
            recordStats(sourceTowerId, dmg);
        }
        
        // Debug Log (Optional)
        // console.log(`[Damage] Type ${towerType} -> Enemy ${enemy.id}: ${amount.toFixed(1)} -> ${dmg.toFixed(1)}`);

        return dmg;
    }

    /**
     * Applies Frost Aura slow to enemies.
     */
    applyFrostAuras(
        enemies: Enemy[], 
        frostTowers: Tower[], 
        getUpgradeLevel: (tier: number, type: 'damage' | 'range' | 'golden') => number
    ) {
        if (enemies.length === 0 || frostTowers.length === 0) return;

        const golden = getUpgradeLevel(1, 'golden');
        const auraMultiplier = 1 + golden * 0.1;
        const radius = this.FROST_AURA_RADIUS_BASE * auraMultiplier;
        const radiusSq = radius * radius;
        
        const slowAmount = this.FROST_SLOW_BASE + golden * this.FROST_SLOW_PER_LEVEL;
        const slowMultiplier = Math.max(0.1, 1 - slowAmount);

        for (const enemy of enemies) {
            let isSlowed = false;
            for (const tower of frostTowers) {
                const dx = tower.position.x - enemy.position.x;
                const dy = tower.position.y - enemy.position.y;
                if (dx * dx + dy * dy <= radiusSq) {
                    isSlowed = true;
                    break;
                }
            }

            if (isSlowed) {
                enemy.speedModifier = slowMultiplier;
                enemy.isFrozen = true;
            }
        }
    }

    /**
     * Applies Venom stacks and handles duration reset.
     */
    applyVenomStack(enemy: Enemy, towerDamage: number, specialActive: boolean) {
        if (enemy.isSlime) return; // Immune

        const currentStacks = enemy.venomStacks ?? 0;
        const newStacks = Math.min(this.VENOM_MAX_STACKS, currentStacks + 1);
        
        enemy.venomStacks = newStacks;
        enemy.venomDuration = this.VENOM_DURATION;
        enemy.venomTickTimer = 0;
        
        const currentBase = enemy.venomBaseDamage ?? 0;
        enemy.venomBaseDamage = Math.max(currentBase, towerDamage);

        if (specialActive) {
            enemy.venomSlowActive = true;
        }
    }

    /**
     * Processes Venom DoT tick.
     * Returns damage to deal.
     */
    processVenomTick(enemy: Enemy, dt: number): number {
        if (!enemy.venomDuration || enemy.venomDuration <= 0) return 0;
        if (!enemy.venomStacks || enemy.venomStacks <= 0) return 0;

        enemy.venomDuration = Math.max(0, enemy.venomDuration - dt);
        enemy.venomTickTimer = (enemy.venomTickTimer ?? 0) + dt;
        
        let damageToDeal = 0;
        const tickInterval = 1.0; 

        while (enemy.venomTickTimer >= tickInterval && enemy.venomDuration > 0) {
            enemy.venomTickTimer -= tickInterval;
            const tickDamage = enemy.venomBaseDamage ?? 0;
            damageToDeal += tickDamage * enemy.venomStacks;
        }

        if (enemy.venomDuration <= 0) {
            enemy.venomStacks = 0;
            enemy.venomTickTimer = 0;
            enemy.venomSlowActive = false;
        } else if (enemy.venomSlowActive) {
             enemy.speedModifier *= this.VENOM_SLOW_MODIFIER;
        }

        return damageToDeal;
    }

    createInfernoZone(target: Position, id: string, radius: number): InfernoZone {
        return {
            id,
            position: { ...target },
            radius,
            remaining: 0.3,
            dps: 0 // Visual only, or handled by direct hit?
        };
    }
}
