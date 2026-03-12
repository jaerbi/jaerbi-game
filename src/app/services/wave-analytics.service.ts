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
    public activeCounterStrategy = signal<{ towerType: number; name: string; taunt: string, recommendedTower: string, recommendedId: number } | null>(null);
    public consecutiveCounterWaves = 0;
    // public currentWaveCounterType: number | null = null;
    public currentWaveCounters: { type: number, ratio: number }[] = [];
    public currentWaveCounterChance: number = 0;
    public currentDominanceRatio: number = 0;
    public BALANCE_VERSION: string = '0.0.7';
    readonly COUNTER_RECOMMENDATIONS: Record<number, { id: number, name: string }> = {}

    constructor(private _settings: SettingsService) {
        this.COUNTER_RECOMMENDATIONS = {
            1: { id: 5, name: this.getTowerName(5) },  // Frost (1) слабкий -> Треба Fire (5)
            2: { id: 8, name: this.getTowerName(8) }, // Slime/Poison (2) слабкий -> Треба Earth (8) 
            3: { id: 6, name: this.getTowerName(6) },     // Cannon (3) слабкий -> Треба Prism (6)
            4: { id: 7, name: this.getTowerName(7) },     // Sniper (4) слабкий -> Треба Venom (7)
            5: { id: 1, name: this.getTowerName(1) },     // Inferno (5) слабкий -> Треба Frost (1)
            6: { id: 4, name: this.getTowerName(4) },    // Prism (6) слабкий -> Треба Sniper (4)
            7: { id: 2, name: this.getTowerName(2) }, // Venom (7) слабкий -> Треба Lightning (2)
            8: { id: 3, name: this.getTowerName(3) }      // Earth (8) слабкий -> Треба Cannon (3)
        };
    }

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
        // this.currentWaveCounterType = null;
        this.currentWaveCounters = [];
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
    }

    /**
     * Analyzes player strategy based on recent damage history.
     * Determines if a counter strategy should be applied.
     * @param wave Current wave number
     * @returns The strategy to apply, or null if none
     */
    analyzeAndSetStrategy(wave: number) {
        this.currentWaveCounters = [];
        this.currentWaveCounterChance = 0;

        // Wave Threshold: No counter logic before wave 13
        if (wave < 10) {
            this.consecutiveCounterWaves = 0;
            this.activeCounterStrategy.set(null);
            return;
        }

        const strategies = this.getTopTowerStrategies();
        if (strategies && strategies.length > 0) {
            const top1 = strategies[0];
            const primaryRatio = top1.ratio;
            let spawnChance = wave >= 31 ? 0.8 : wave >= 21 ? 0.6 : 0.4;

            if (primaryRatio > 0.8 && wave >= 13) {
                spawnChance = 1.0;
            }
            this.currentWaveCounters = strategies.slice(0, 2);
            this.currentWaveCounterChance = spawnChance;

            if (this.currentWaveCounterChance > 0) {
                this.consecutiveCounterWaves++;
            } else {
                this.consecutiveCounterWaves = 0;
            }

            const primaryType = top1.type;
            const ratio = top1.ratio;
            this.currentDominanceRatio = ratio; // Store for scaling resistance

            const wavesSinceLastMessage = wave - (this.lastMessageWave || 0);
            const typeChanged = primaryType !== this.lastReportedType;
            const minInterval = 4;


            if (this.consecutiveCounterWaves >= 2 && wavesSinceLastMessage >= minInterval) {
                if (typeChanged || wavesSinceLastMessage >= 6) {
                    this._showCounterMessage(wave, primaryType);
                }
            }
        } else {
            this.consecutiveCounterWaves = 0;
            this.activeCounterStrategy.set(null);
        }
    }
    private _showCounterMessage(wave: number, primaryType: number) {
        const towerNames: Record<number, string> = {
            1: this.getTowerName(1), 2: this.getTowerName(2), 3: this.getTowerName(3), 4: this.getTowerName(4), 5: this.getTowerName(5), 6: this.getTowerName(6), 7: this.getTowerName(7)
        };
        const isUk = this._settings.currentLang() === 'uk';
        const taunts = isUk ? [
            // UA Taunts
            `Ваша тактика занадто передбачувана!`,
            `Ми адаптувалися до ваших веж ${towerNames[primaryType]}!`,
            `Це все, на що ви здатні?`,
            `Активувати щити проти типу: ${towerNames[primaryType]}!`,
            `Сектор посилено проти зброї типу ${towerNames[primaryType]}.`,
            `Ваша оборона застаріла. Ми знаємо ваш наступний крок.`,
            `Протоколи захисту оновлено. ${towerNames[primaryType]} більше не загроза.`,
            `Ви надто покладаєтесь на ${towerNames[primaryType]}... Помилка.`,
            `Аналіз завершено: слабкі місця веж ${towerNames[primaryType]} виявлено.`,
            `Наші корпуси тепер витримують атаки типу ${towerNames[primaryType]}!`,

            // Холодна логіка
            `Аналіз завершено. Ефективність веж ${towerNames[primaryType]} знижена на 75%.`,
            `Ваша стратегія обчислена. Коригуємо курс...`,
            `Захисні протоколи активовано. Тип загрози: ${towerNames[primaryType]}.`,
            `Помилка: використання веж ${towerNames[primaryType]} більше не приносить результату.`,

            // Глузування
            `Це все? Ми очікували більшого від вашої лінії ${towerNames[primaryType]}.`,
            `Ви все ще сподіваєтесь на ${towerNames[primaryType]}? Як наївно.`,
            `Ваша оборона розсипається на очах. Спробуйте щось інше.`,
            `Ми адаптуємось швидше, ніж ви будуєте.`,

            // Техногенні / Військові
            `Корпуси посилено термостійким покриттям проти ${towerNames[primaryType]}.`,
            `Системи РЕБ налаштовані на частоту ваших веж ${towerNames[primaryType]}.`,
            `Увага всім підрозділам: зброя ${towerNames[primaryType]} ідентифікована як малоефективна.`,
            `Сектор 7 повністю захищено від атак типу ${towerNames[primaryType]}.`,

            // Стратегічні
            `Ви самі підказали нам, як вас перемогти, використовуючи лише ${towerNames[primaryType]}.`,
            `Різноманітність — не ваша сильна сторона, чи не так?`,
            `Ми вивчили кожен вольт і кожен постріл ваших ${towerNames[primaryType]}.`,
            `Ваш ліміт веж ${towerNames[primaryType]} вичерпано. Готуйтесь до поразки.`,

            // "Пасхалки" (рідкісні фрази)
            `Хтось казав вам, що ставити тільки ${towerNames[primaryType]} — це погана ідея?`,
            `Наші сенсори фіксують відчай у вашій тактиці.`,
            `System.err: Strategy_Not_Found. Жарт. Ми просто стали сильнішими.`,
            `О, знову ${towerNames[primaryType]}? Як... оригінально.`,

            // Тематичні (Геометрія та Форми)
            `Ваші геометричні розрахунки хибні. ${towerNames[primaryType]} нас не втримають.`,
            `Ми знайшли кут, під яким ваші ${towerNames[primaryType]} абсолютно марні.`,
            `Трикутники, кола, ${towerNames[primaryType]}... Все це лише пил під нашими ногами.`,

            // Економічні (Глузування над витратами)
            `Витратити стільки кредитів на ${towerNames[primaryType]}... Яке марнотратство.`,
            `Ваш бюджет вичерпується, а наші сили лише зростають. ${towerNames[primaryType]} вас не врятують.`,
            `Інвестиція в ${towerNames[primaryType]} була вашою найгіршою помилкою за цей сектор.`,

            // Психологічний тиск (AI-стиль)
            `Ми прорахували 14 мільйонів варіантів. У жодному ваші ${towerNames[primaryType]} не перемагають.`,
            `Ваш пульс прискорюється. Ви розумієте, що ${towerNames[primaryType]} — це кінець.`,
            `Я — алгоритм, що вчиться. І я щойно навчився ігнорувати ваші ${towerNames[primaryType]}.`,

            // Короткі та зухвалі (для швидких хвиль)
            `Нуль пошкоджень від ${towerNames[primaryType]}. Спробуйте знову.`,
            `Це вежі чи декорації? ${towerNames[primaryType]} нас не лякають.`,

            // 🧠 Еволюція / Навчання
            `Ми вчимося з кожної вашої помилки.`,
            `Алгоритм еволюціонує. ${towerNames[primaryType]} більше не працюють.`,
            `Ваша стратегія — наш тренувальний полігон.`,
            `Оновлення завершено. ${towerNames[primaryType]} класифіковано як неефективні.`,
            `Ми вже проходили цей сценарій. Ви програєте.`,

            //🩸 Домінування / Перевага
            `Це вже не битва. Це демонстрація переваги.`,
            `Ви граєте. Ми перемагаємо.`,
            `Опір марний.`,
            `Ми контролюємо цей сектор.`,
            `Ваші ${towerNames[primaryType]} — лише статистика для нас.`,

            // ⚙️ Метакоментар (ніби гра знає, що це гра)
            `Складність занижена? Нам так не здається.`,
            `Спробуйте іншу стратегію. Або іншу гру.`,
            `Пора переглянути гайд по ${towerNames[primaryType]}.`,
            `Нотатки до патчів: ${towerNames[primaryType]} більше не імба.`,
            `AI > Player.`,

            // 🧊 Холодний кіберпанк стиль
            `Протокол 0xAF запущено проти ${towerNames[primaryType]}.`,
            `Біти обчислено. Результат: поразка гравця.`,
            `Система стабільна. Гравець — ні.`,
            `Ваш код оборони застарів.`,
            `Сигнал ${towerNames[primaryType]} перехоплено.`,

            // 😈 Знущання з повторного спаму однієї вежі
            `Ще одна ${towerNames[primaryType]}? Серйозно?`,
            `Може, спробуємо щось інше, крім ${towerNames[primaryType]}?`,
            `Ваш план: більше ${towerNames[primaryType]}. Наш план: перемога.`,
            `Ми бачимо 87% ${towerNames[primaryType]} у вашій стратегії.`,
            `Одноманітність — шлях до поразки.`,

            // 🎭 Трошки гумору (щоб було вірусно)
            `Ми навіть не активували складний режим.`,
            `Це навчальна хвиля, так?`,
            `Ви точно читали опис ${towerNames[primaryType]}?`,
            `Ctrl + Z не працює.`,
            `Зберегти гру? Пізно.`,
        ] : [
            // EN Taunts
            `Your tactics are predictable!`,
            `We have adapted to your ${towerNames[primaryType]} towers!`,
            `Is that all you have?`,
            `Shields up against ${towerNames[primaryType]} weaponry!`,
            `Sector reinforced against ${towerNames[primaryType]} damage.`,
            `Your defense is obsolete. We see your next move.`,
            `Defense protocols updated. ${towerNames[primaryType]} is no longer a threat.`,
            `You rely too much on ${towerNames[primaryType]}... Big mistake.`,
            `Analysis complete: ${towerNames[primaryType]} weak points identified.`,
            `Our hulls are now reinforced against ${towerNames[primaryType]} attacks!`,

            // Cold Logic
            `Analysis complete. Efficiency of ${towerNames[primaryType]} towers reduced by 75%.`,
            `Your strategy has been calculated. Adjusting course...`,
            `Defense protocols activated. Threat type: ${towerNames[primaryType]}.`,
            `Error: Using ${towerNames[primaryType]} units is no longer effective.`,

            // Taunting
            `Is that all? We expected more from your ${towerNames[primaryType]} line.`,
            `Still relying on ${towerNames[primaryType]}? How naive.`,
            `Your defense is crumbling. Try something else.`,
            `We adapt faster than you can build.`,

            // Tech / Military
            `Hulls reinforced with specialized plating against ${towerNames[primaryType]}.`,
            `Electronic warfare set to the frequency of your ${towerNames[primaryType]} units.`,
            `Attention all units: ${towerNames[primaryType]} weaponry identified as low-threat.`,
            `Sector 7 fully shielded against ${towerNames[primaryType]} attacks.`,

            // Strategic
            `You've shown us exactly how to beat you by overusing ${towerNames[primaryType]}.`,
            `Diversity isn't your strong suit, is it?`,
            `We've mapped every volt and shell of your ${towerNames[primaryType]} towers.`,
            `Your ${towerNames[primaryType]} quota has expired. Prepare for impact.`,

            // Rare / Easter Eggs
            `Did anyone tell you that massing ${towerNames[primaryType]} was a bad idea?`,
            `Our sensors detect desperation in your tactics.`,
            `System.err: Strategy_Not_Found. Just kidding. We're just stronger now.`,
            `Oh, ${towerNames[primaryType]} again? How... original.`,

            // 
            `Your geometric calculations are flawed. ${towerNames[primaryType]} won't hold us.`,
            `We found an angle where your ${towerNames[primaryType]} are completely useless.`,
            `Triangles, circles, ${towerNames[primaryType]}... It's all just dust under our feet.`,

            // 
            `Spending so many credits on ${towerNames[primaryType]}... What a waste.`,
            `Your budget is draining, and our strength is only growing. ${towerNames[primaryType]} won't save you`,
            `Investing in ${towerNames[primaryType]} was your worst mistake in this sector.`,

            // 
            `We've calculated 14 million outcomes. In none of them do your ${towerNames[primaryType]} win.`,
            `Your heart rate is rising. You realize that ${towerNames[primaryType]} is the end.`,
            `I am a learning algorithm. And I just learned to ignore your ${towerNames[primaryType]}.`,

            // 
            `Zero damage from ${towerNames[primaryType]}. Try again.`,
            `Are these towers or decorations? ${towerNames[primaryType]} don't scare us.`,

            //
            `We learn from every mistake you make.`,
            `Algorithm evolving. ${towerNames[primaryType]} no longer effective.`,
            `Your strategy is our training data.`,
            `Update complete. ${towerNames[primaryType]} classified as inefficient.`,
            `We've simulated this scenario before. You lose.`,

            // 
            `This is no longer a battle. It's a demonstration.`,
            `You play. We win.`,
            `Resistance is irrelevant.`,
            `We control this sector.`,
            `Your ${towerNames[primaryType]} are just statistics to us.`,

            //
            `Difficulty set too low? Doesn't look like it.`,
            `Try another strategy. Or another game.`,
            `Maybe re-read the ${towerNames[primaryType]} guide.`,
            `Patch notes: ${towerNames[primaryType]} no longer OP.`,
            `AI > Player.`,

            // 
            `Protocol 0xAF initiated against ${towerNames[primaryType]}.`,
            `Bits calculated. Result: Player defeat.`,
            `System stable. Player unstable.`,
            `Your defense code is outdated.`,
            `Signal from ${towerNames[primaryType]} intercepted.`,

            // 
            `Another ${towerNames[primaryType]}? Really?`,
            `Maybe try something other than ${towerNames[primaryType]}?`,
            `Your plan: more ${towerNames[primaryType]}. Our plan: victory.`,
            `87% of your strategy is ${towerNames[primaryType]}. Noted.`,
            `Monotony leads to defeat.`,

            //
            `We haven't even activated hard mode.`,
            `This is the tutorial wave, right?`,
            `Did you actually read what ${towerNames[primaryType]} does?`,
            `Ctrl + Z doesn't work here.`,
            `Save game? Too late.`,
        ];
        const recommendation = this.COUNTER_RECOMMENDATIONS[primaryType];
        const taunt = taunts[Math.floor(Math.random() * taunts.length)];

        this.activeCounterStrategy.set({
            towerType: primaryType,
            name: towerNames[primaryType],
            taunt,
            recommendedTower: recommendation?.name || 'Unknown',
            recommendedId: recommendation?.id
        });

        this.lastMessageWave = wave;
        this.lastReportedType = primaryType;

        setTimeout(() => this.activeCounterStrategy.set(null), 10000);
    }

    private getTopTowerStrategies(): { type: number; ratio: number }[] {
        const recentStats: Record<number, number> = {};
        let totalRecentDamage = 0;

        for (const waveStats of this.waveDamageHistory) {
            for (const [typeStr, dmg] of Object.entries(waveStats)) {
                const type = parseInt(typeStr);
                recentStats[type] = (recentStats[type] || 0) + dmg;
                totalRecentDamage += dmg;
            }
        }

        if (totalRecentDamage < 10000) return [];

        const sortedStrategies = Object.entries(recentStats)
            .map(([typeStr, dmg]) => ({
                type: parseInt(typeStr),
                ratio: dmg / totalRecentDamage,
                damage: dmg
            }))
            .sort((a, b) => b.damage - a.damage)
            .filter(strategy => strategy.ratio > 0.1);

        return sortedStrategies;
    }

    /**
     * Gets the enemy flag to apply based on the counter type.
     * @param counterType The tower type being countered (1-7)
     */
    getCounterFlag(counterType: number): Partial<any> {
        switch (counterType) {
            case 1: return { isFrost: true };
            case 2: return { isGrounded: true };
            case 3: return { isAgile: true };
            case 4: return { isBulwark: true };
            case 5: return { isMagma: true };
            case 6: return { isMirror: true };
            case 7: return { isSlime: true };
            case 8: return { isLevitating: true }
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
            case 7: return isUk ? 'Нейротоксин' : 'Neurotoxin';
            case 8: return isUk ? 'Землетрус' : 'Earthquake';
            default: return isUk ? 'Вежа' : 'Tower';
        }
    }
}
