import { Injectable, signal } from '@angular/core';
import { SettingsService } from './settings.service';

@Injectable({
    providedIn: 'root'
})
export class WaveAnalyticsService {
    // State for rolling analytics
    private waveDamageHistory: Record<number, number>[] = []; // Last 3 waves
    private lastWaveTotalStats: Record<number, number> = {};
    private lastMessageWave = 0;
    private lastReportedType: number | null = null;

    // Counter Strategy State
    public activeCounterStrategy = signal<{ towerType: number; name: string; taunt: string } | null>(null);
    public consecutiveCounterWaves = 0;
    public currentWaveCounterType: number | null = null;
    public currentWaveCounterChance: number = 0;
    public currentDominanceRatio: number = 0;

    constructor(private _settings: SettingsService) { }

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

        // Wave Threshold: No counter logic before wave 13
        if (wave < 13) {
            this.consecutiveCounterWaves = 0;
            this.activeCounterStrategy.set(null);
            return;
        }

        const strategy = this.getDominantTowerType();

        if (strategy) {
            const { type, ratio } = strategy;
            let spawnChance = wave >= 31 ? 0.8 : wave >= 21 ? 0.6 : 0.4;
            
            // Mono-Penalty: If ratio > 0.8, force 100% chance (Wave 15+)
            if (ratio > 0.8 && wave >= 15) {
                spawnChance = 1.0;
            }

            this.currentWaveCounterType = type;
            this.currentWaveCounterChance = spawnChance;
            this.currentDominanceRatio = ratio; // Store for scaling resistance
            if (this.currentWaveCounterChance > 0) {
                this.consecutiveCounterWaves++;
            } else {
                this.consecutiveCounterWaves = 0;
            }

            const wavesSinceLastMessage = wave - this.lastMessageWave;
            const typeChanged = type !== this.lastReportedType;

            const towerNames: Record<number, string> = {
                1: this.getTowerName(1), 2: this.getTowerName(2), 3: this.getTowerName(3), 4: this.getTowerName(4), 5: this.getTowerName(5), 6: this.getTowerName(6), 7: this.getTowerName(7)
            };

            if (this.consecutiveCounterWaves >= 2 && (wavesSinceLastMessage >= 3 || typeChanged)) {
                const isUk = this._settings.currentLang() === 'uk';
                const taunts = isUk ? [
                    // UA Taunts
                    `Ваша тактика занадто передбачувана!`,
                    `Ми адаптувалися до ваших веж ${towerNames[type]}!`,
                    `Це все, на що ви здатні?`,
                    `Активувати щити проти типу: ${towerNames[type]}!`,
                    `Сектор посилено проти зброї типу ${towerNames[type]}.`,
                    `Ваша оборона застаріла. Ми знаємо ваш наступний крок.`,
                    `Протоколи захисту оновлено. ${towerNames[type]} більше не загроза.`,
                    `Ви надто покладаєтесь на ${towerNames[type]}... Помилка.`,
                    `Аналіз завершено: слабкі місця веж ${towerNames[type]} виявлено.`,
                    `Наші корпуси тепер витримують атаки типу ${towerNames[type]}!`,

                    // Холодна логіка
                    `Аналіз завершено. Ефективність веж ${towerNames[type]} знижена на 75%.`,
                    `Ваша стратегія обчислена. Коригуємо курс...`,
                    `Захисні протоколи активовано. Тип загрози: ${towerNames[type]}.`,
                    `Помилка: використання веж ${towerNames[type]} більше не приносить результату.`,

                    // Глузування
                    `Це все? Ми очікували більшого від вашої лінії ${towerNames[type]}.`,
                    `Ви все ще сподіваєтесь на ${towerNames[type]}? Як наївно.`,
                    `Ваша оборона розсипається на очах. Спробуйте щось інше.`,
                    `Ми адаптуємось швидше, ніж ви будуєте.`,

                    // Техногенні / Військові
                    `Корпуси посилено термостійким покриттям проти ${towerNames[type]}.`,
                    `Системи РЕБ налаштовані на частоту ваших веж ${towerNames[type]}.`,
                    `Увага всім підрозділам: зброя ${towerNames[type]} ідентифікована як малоефективна.`,
                    `Сектор 7 повністю захищено від атак типу ${towerNames[type]}.`,

                    // Стратегічні
                    `Ви самі підказали нам, як вас перемогти, використовуючи лише ${towerNames[type]}.`,
                    `Різноманітність — не ваша сильна сторона, чи не так?`,
                    `Ми вивчили кожен вольт і кожен постріл ваших ${towerNames[type]}.`,
                    `Ваш ліміт веж ${towerNames[type]} вичерпано. Готуйтесь до поразки.`,

                    // "Пасхалки" (рідкісні фрази)
                    `Хтось казав вам, що ставити тільки ${towerNames[type]} — це погана ідея?`,
                    `Наші сенсори фіксують відчай у вашій тактиці.`,
                    `System.err: Strategy_Not_Found. Жарт. Ми просто стали сильнішими.`,
                    `О, знову ${towerNames[type]}? Як... оригінально.`,

                    // Тематичні (Геометрія та Форми)
                    `Ваші геометричні розрахунки хибні. ${towerNames[type]} нас не втримають.`,
                    `Ми знайшли кут, під яким ваші ${towerNames[type]} абсолютно марні.`,
                    `Трикутники, кола, ${towerNames[type]}... Все це лише пил під нашими ногами.`,

                    // Економічні (Глузування над витратами)
                    `Витратити стільки кредитів на ${towerNames[type]}... Яке марнотратство.`,
                    `Ваш бюджет вичерпується, а наші сили лише зростають. ${towerNames[type]} вас не врятують.`,
                    `Інвестиція в ${towerNames[type]} була вашою найгіршою помилкою за цей сектор.`,

                    // Психологічний тиск (AI-стиль)
                    `Ми прорахували 14 мільйонів варіантів. У жодному ваші ${towerNames[type]} не перемагають.`,
                    `Ваш пульс прискорюється. Ви розумієте, що ${towerNames[type]} — це кінець.`,
                    `Я — алгоритм, що вчиться. І я щойно навчився ігнорувати ваші ${towerNames[type]}.`,

                    // Короткі та зухвалі (для швидких хвиль)
                    `Нуль пошкоджень від ${towerNames[type]}. Спробуйте знову.`,
                    `Це вежі чи декорації? ${towerNames[type]} нас не лякають.`
                ] : [
                    // EN Taunts
                    `Your tactics are predictable!`,
                    `We have adapted to your ${towerNames[type]} towers!`,
                    `Is that all you have?`,
                    `Shields up against ${towerNames[type]} weaponry!`,
                    `Sector reinforced against ${towerNames[type]} damage.`,
                    `Your defense is obsolete. We see your next move.`,
                    `Defense protocols updated. ${towerNames[type]} is no longer a threat.`,
                    `You rely too much on ${towerNames[type]}... Big mistake.`,
                    `Analysis complete: ${towerNames[type]} weak points identified.`,
                    `Our hulls are now reinforced against ${towerNames[type]} attacks!`,

                    // Cold Logic
                    `Analysis complete. Efficiency of ${towerNames[type]} towers reduced by 75%.`,
                    `Your strategy has been calculated. Adjusting course...`,
                    `Defense protocols activated. Threat type: ${towerNames[type]}.`,
                    `Error: Using ${towerNames[type]} units is no longer effective.`,

                    // Taunting
                    `Is that all? We expected more from your ${towerNames[type]} line.`,
                    `Still relying on ${towerNames[type]}? How naive.`,
                    `Your defense is crumbling. Try something else.`,
                    `We adapt faster than you can build.`,

                    // Tech / Military
                    `Hulls reinforced with specialized plating against ${towerNames[type]}.`,
                    `Electronic warfare set to the frequency of your ${towerNames[type]} units.`,
                    `Attention all units: ${towerNames[type]} weaponry identified as low-threat.`,
                    `Sector 7 fully shielded against ${towerNames[type]} attacks.`,

                    // Strategic
                    `You've shown us exactly how to beat you by overusing ${towerNames[type]}.`,
                    `Diversity isn't your strong suit, is it?`,
                    `We've mapped every volt and shell of your ${towerNames[type]} towers.`,
                    `Your ${towerNames[type]} quota has expired. Prepare for impact.`,

                    // Rare / Easter Eggs
                    `Did anyone tell you that massing ${towerNames[type]} was a bad idea?`,
                    `Our sensors detect desperation in your tactics.`,
                    `System.err: Strategy_Not_Found. Just kidding. We're just stronger now.`,
                    `Oh, ${towerNames[type]} again? How... original.`,

                    // 
                    `Your geometric calculations are flawed. ${towerNames[type]} won't hold us.`,
                    `We found an angle where your ${towerNames[type]} are completely useless.`,
                    `Triangles, circles, ${towerNames[type]}... It's all just dust under our feet.`,

                    // 
                    `Spending so many credits on ${towerNames[type]}... What a waste.`,
                    `Your budget is draining, and our strength is only growing. ${towerNames[type]} won't save you`,
                    `Investing in ${towerNames[type]} was your worst mistake in this sector.`,

                    // 
                    `We've calculated 14 million outcomes. In none of them do your ${towerNames[type]} win.`,
                    `Your heart rate is rising. You realize that ${towerNames[type]} is the end.`,
                    `I am a learning algorithm. And I just learned to ignore your ${towerNames[type]}.`,

                    // 
                    `Zero damage from ${towerNames[type]}. Try again.`,
                    `Are these towers or decorations? ${towerNames[type]} don't scare us.`
                ];

                const taunt = taunts[Math.floor(Math.random() * taunts.length)];

                this.activeCounterStrategy.set({
                    towerType: type,
                    name: towerNames[type],
                    taunt
                });

                this.lastMessageWave = wave;
                this.lastReportedType = type;

                setTimeout(() => this.activeCounterStrategy.set(null), 8000);
            }

            this.currentWaveCounterType = type;
            this.currentWaveCounterChance = spawnChance;
        } else {
            this.consecutiveCounterWaves = 0;
            this.activeCounterStrategy.set(null);
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

        if (totalRecentDamage < 10000) return null; // Wait for significant data

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

    getTowerName(type: number): string {
        const isUk = this._settings.currentLang() === 'uk';

        switch (type) {
            case 1: return isUk ? 'Льодяна' : 'Ice';
            case 2: return isUk ? 'Блискавка' : 'Lightning';
            case 3: return isUk ? 'Розколювач' : 'Shatter';
            case 4: return isUk ? 'Кат' : 'Executioner';
            case 5: return isUk ? 'Інферно' : 'Inferno';
            case 6: return isUk ? 'Призматичний промінь' : 'Prism Beam';
            default: return isUk ? 'Нейротоксин' : 'Neurotoxin';
        }
    }
}
