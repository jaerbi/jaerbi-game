import { Injectable, signal } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class WaveAnalyticsService {
    // State for rolling analytics
    private waveDamageHistory: Record<number, number>[] = []; // Last 3 waves
    private lastWaveTotalStats: Record<number, number> = {};
    
    // Counter Strategy State
    public activeCounterStrategy = signal<{ towerType: number; name: string; taunt: string } | null>(null);
    public consecutiveCounterWaves = 0;
    public currentWaveCounterType: number | null = null;
    public currentWaveCounterChance: number = 0;

    constructor() {}

    /**
     * Checks if an enemy is resistant to a specific tower type.
     * @param enemy The enemy object
     * @param towerType The tower type dealing damage
     */
    isResistant(enemy: any, towerType: number): boolean {
        switch (towerType) {
            case 1: return !!enemy.isFrost;
            case 2: return !!enemy.isGrounded;
            case 3: return !!enemy.isAgile;
            case 4: return !!enemy.isBulwark;
            case 5: return !!enemy.isMagma;
            case 6: return !!enemy.isMirror;
            case 7: return !!enemy.isSlime;
            default: return false;
        }
    }

    reset() {
        this.waveDamageHistory = [];
        this.lastWaveTotalStats = {};
        this.consecutiveCounterWaves = 0;
        this.currentWaveCounterType = null;
        this.currentWaveCounterChance = 0;
        this.activeCounterStrategy.set(null);
    }

    /**
     * Updates the rolling analytics with the damage done in the last wave.
     * Should be called at the start of a new wave (before spawning).
     * @param currentTotalStats Total damage stats from the engine
     */
    updateRollingAnalytics(currentTotalStats: Record<number, number>) {
        const deltaStats: Record<number, number> = {};
        
        // Calculate delta
        for (const [typeStr, totalDmg] of Object.entries(currentTotalStats)) {
            const type = parseInt(typeStr);
            const prev = this.lastWaveTotalStats[type] || 0;
            const delta = totalDmg - prev;
            if (delta > 0) {
                deltaStats[type] = delta;
            }
        }
        
        // Update history
        this.waveDamageHistory.push(deltaStats);
        if (this.waveDamageHistory.length > 3) {
            this.waveDamageHistory.shift();
        }
        
        // Snapshot current for next time
        this.lastWaveTotalStats = { ...currentTotalStats };

        // Debug Log
        console.log('[WaveAnalytics] Updated Rolling History:', this.waveDamageHistory);
    }

    /**
     * Analyzes player strategy based on recent damage history.
     * Determines if a counter strategy should be applied.
     * @param wave Current wave number
     * @returns The strategy to apply, or null if none
     */
    analyzeAndSetStrategy(wave: number) {
        // Reset current counter
        this.currentWaveCounterType = null;
        this.currentWaveCounterChance = 0;

        // Wave Threshold: No counter logic before wave 15
        if (wave < 15) {
            this.consecutiveCounterWaves = 0;
            this.activeCounterStrategy.set(null);
            return;
        }

        const strategy = this.getDominantTowerType();
        
        if (strategy) {
            const { type, ratio } = strategy;
            let spawnChance = 0;
            
            // Logic: Smooth Difficulty Escalation
            if (wave >= 15 && wave <= 20) {
                spawnChance = 0.4;
            } else if (wave >= 21 && wave <= 30) {
                spawnChance = 0.6;
            } else if (wave >= 31) {
                spawnChance = 0.8;
            }
            
            if (spawnChance > 0) {
                this.consecutiveCounterWaves++;
            } else {
                this.consecutiveCounterWaves = 0;
            }
            
            const towerNames: Record<number, string> = {
                1: 'Ice', 
                2: 'Lightning', 
                3: 'Cannon', // User mapped Type 3 to Cannon/Agile
                4: 'Sniper', 
                5: 'Inferno', 
                6: 'Prism', 
                7: 'Venom'
            };
            
            // Trigger UI only if consecutive >= 2
            if (this.consecutiveCounterWaves >= 2) {
                const taunts = [
                    `Your tactics are predictable!`,
                    `We have adapted to your ${towerNames[type]}!`,
                    `Is that all you have?`,
                    `Shields up against ${towerNames[type]}!`
                ];
                const taunt = taunts[Math.floor(Math.random() * taunts.length)];
                
                // Set active strategy for UI
                this.activeCounterStrategy.set({ towerType: type, name: towerNames[type], taunt });
                
                // Auto-hide toast after 7s
                setTimeout(() => {
                    this.activeCounterStrategy.set(null);
                }, 7000);
            }

            this.currentWaveCounterType = type;
            this.currentWaveCounterChance = spawnChance;

            console.log(`[WaveAnalytics] Strategy Detected: Type ${type} (${towerNames[type]}) with ratio ${ratio.toFixed(2)}. Spawn Chance: ${spawnChance}`);
        } else {
            this.consecutiveCounterWaves = 0;
            this.activeCounterStrategy.set(null);
            console.log('[WaveAnalytics] No dominant strategy detected.');
        }
    }

    private getDominantTowerType(): { type: number; ratio: number } | null {
        // Sum up recent history
        const recentStats: Record<number, number> = {};
        let totalRecentDamage = 0;
        
        for (const waveStats of this.waveDamageHistory) {
            for (const [typeStr, dmg] of Object.entries(waveStats)) {
                const type = parseInt(typeStr);
                recentStats[type] = (recentStats[type] || 0) + dmg;
                totalRecentDamage += dmg;
            }
        }

        if (totalRecentDamage < 1000) return null; // Wait for significant data

        let maxType = 0;
        let maxDmg = 0;
        
        for (const [typeStr, dmg] of Object.entries(recentStats)) {
            const type = parseInt(typeStr);
            if (dmg > maxDmg) {
                maxDmg = dmg;
                maxType = type;
            }
        }

        if (maxType === 0) return null;
        return { type: maxType, ratio: maxDmg / totalRecentDamage };
    }

    /**
     * Gets the enemy flag to apply based on the counter type.
     * @param counterType The tower type being countered (1-7)
     */
    getCounterFlag(counterType: number): Partial<any> {
        switch (counterType) {
            case 1: return { isFrost: true };      // Type 1 (Ice) -> isFrost
            case 2: return { isGrounded: true };   // Type 2 (Lightning) -> isGrounded
            case 3: return { isAgile: true };      // Type 3 (Cannon) -> isAgile
            case 4: return { isBulwark: true };    // Type 4 (Sniper) -> isBulwark
            case 5: return { isMagma: true };      // Type 5 (Inferno) -> isMagma
            case 6: return { isMirror: true };     // Type 6 (Prism) -> isMirror
            case 7: return { isSlime: true };      // Type 7 (Venom) -> isSlime
            default: return {};
        }
    }
}
