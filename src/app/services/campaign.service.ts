import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

export interface LevelConfig {
    id: string;
    name: string;
    description: string;
    waveCount: number;
    startingGold: number;
    allowedTowers: number[];
    mapLayout?: 'static' | 'random';
    difficulty: 'easy' | 'normal' | 'hard';
    xpReward: number;
    gridSize?: number;
    customPath?: { x: number; y: number }[];
    bonusTiles?: { x: number; y: number; type: 'damage' | 'range' | 'bounty' | 'mastery' }[];
    healthMultiplier?: number;
}

@Injectable({
    providedIn: 'root'
})
export class CampaignService {

    levels: LevelConfig[] = [];

    // TOWER IDs REFERENCE:
    // 1: Turret (Basic)
    // 2: Cannon (Splash)
    // 3: Ice (Slow)
    // 4: Sniper (Long Range)
    // 5: Inferno (AOE/Burn)
    // 6: Prism (Laser/Buff)
    // 7: Poison (DoT)

    constructor(private _settings: SettingsService) { this.initLevels(); }

    private initLevels(): void {
        const isUa = this._settings.currentLang() === 'uk';

        this.levels = [
            // ============================================================
            // LEVEL 1: Basic Positioning (Turret only)
            // Challenge: You only have enough money for 1 turret. If you don't place it
            // on the DAMAGE tile, the enemies will break through.
            // ============================================================
            {
                id: 'level_1',
                name: isUa ? '1. Перший Рубіж' : '1. First Defense',
                description: isUa
                    ? 'Ваші ресурси обмежені. Використовуйте бонусні клітинки, щоб підсилити єдину доступну вежу.'
                    : 'Resources are scarce. Use bonus tiles to buff your only available tower.',
                waveCount: 8,
                startingGold: 45,
                allowedTowers: [1],
                mapLayout: 'static',
                difficulty: 'easy',
                xpReward: 20,
                gridSize: 10,
                healthMultiplier: 1.0,
                // Simple S-shape
                customPath: [
                    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 },
                    { x: 4, y: 3 }, { x: 4, y: 4 },
                    { x: 3, y: 4 }, { x: 2, y: 4 }, { x: 1, y: 4 }, { x: 0, y: 4 },
                    { x: 0, y: 5 }, { x: 0, y: 6 },
                    { x: 1, y: 6 }, { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 }, { x: 8, y: 6 }, { x: 9, y: 6 }
                ],
                bonusTiles: [
                    { x: 2, y: 3, type: 'damage' }, // Strategic point, covers two lines
                    { x: 7, y: 5, type: 'range' }   // Trap: Looks nice, but it's too far from the entrance for the Turret
                ]
            },

            // ============================================================
            // LEVEL 2: Cannon Intro
            // Challenge: There are too many enemies (zerg rush). Point turrets won't cope.
            // You need to place the Cannon in the corners.
            // ============================================================
            {
                id: 'level_2',
                name: isUa ? '2. Вузький Прохід' : '2. The Choke',
                description: isUa
                    ? 'Вороги йдуть групами. Використовуйте сплеск (Splash), щоб знищити їх разом.'
                    : 'Enemies swarm together. Use Splash damage to wipe them out at once.',
                waveCount: 12,
                startingGold: 130, // Cannon (120) + трохи
                allowedTowers: [1, 2], // Turret, Cannon
                mapLayout: 'static',
                difficulty: 'normal',
                xpReward: 25,
                gridSize: 12,
                healthMultiplier: 0.9, // Трохи слабші, але їх багато
                // Tight spiral/snake
                customPath: [
                    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 },
                    { x: 4, y: 1 }, { x: 4, y: 2 },
                    { x: 3, y: 2 }, { x: 2, y: 2 }, { x: 1, y: 2 }, { x: 0, y: 2 },
                    { x: 0, y: 3 }, { x: 0, y: 4 },
                    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 },
                    { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }
                ],
                bonusTiles: [
                    { x: 2, y: 1, type: 'damage' }, // Ідеально для гармати, б'є по 3 лініях
                    { x: 5, y: 3, type: 'bounty' }  // Для жадібних
                ]
            },

            // ============================================================
            // LEVEL 3: Sniper Intro
            // Challenge: The map is huge, the path is around the perimeter. Normal towers can't reach it.
            // Only the sniper in the center (on the Range tile) can control the map.
            // ============================================================
            {
                id: 'level_3',
                name: isUa ? '3. Снайперська Алея' : '3. Sniper Alley',
                description: isUa
                    ? 'Вороги тримають дистанцію. Займіть висоту і використовуйте радіус огляду.'
                    : 'Enemies keep their distance. Take the high ground and utilize range.',
                waveCount: 15,
                startingGold: 250,
                allowedTowers: [1, 4], // Turret, Sniper
                mapLayout: 'static',
                difficulty: 'normal',
                xpReward: 30,
                gridSize: 15,
                healthMultiplier: 1.2, // Жирні вороги
                // Велике коло по краях
                customPath: [
                    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
                    { x: 14, y: 1 }, { x: 14, y: 2 }, { x: 14, y: 3 }, { x: 14, y: 4 }, { x: 14, y: 5 }, { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 14, y: 9 }, { x: 14, y: 10 }, { x: 14, y: 11 }, { x: 14, y: 12 }, { x: 14, y: 13 }, { x: 14, y: 14 },
                    { x: 13, y: 14 } // Exit
                ],
                bonusTiles: [
                    { x: 7, y: 7, type: 'range' }, // ЦЕНТР. Снайпер тут покриває 80% карти.
                    { x: 2, y: 2, type: 'damage' } // Пастка. Покриває лише початок.
                ]
            },

            // ============================================================
            // LEVEL 4: Синергія Стихій (Ice + Inferno)
            // Челендж: Вороги мають x1.5 HP. Швидко біжать.
            // Без Ice Tower (сповільнення) Inferno не встигає завдати шкоди.
            // ============================================================
            {
                id: 'level_4',
                name: isUa ? '4. Вогонь і Лід' : '4. Fire and Ice',
                description: isUa
                    ? 'Вороги занадто живучі. Сповільніть їх, щоб вони згоріли.'
                    : 'Enemies are tough. Slow them down so they burn to ashes.',
                waveCount: 20,
                startingGold: 350,
                allowedTowers: [3, 5], // Ice, Inferno
                mapLayout: 'static',
                difficulty: 'hard',
                xpReward: 40,
                gridSize: 12,
                healthMultiplier: 1.5, // Дуже живучі
                // Zig-zag vertical
                customPath: [
                    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 },
                    { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
                    { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
                    { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
                    { x: 7, y: 7 }, { x: 7, y: 8 }, { x: 7, y: 9 }, { x: 7, y: 10 }, { x: 7, y: 11 }
                ],
                bonusTiles: [
                    { x: 2, y: 2, type: 'mastery' }, // Пришвидшення перезарядки для Льоду
                    { x: 5, y: 5, type: 'damage' }   // Для Inferno в центрі "змійки"
                ]
            },

            // ============================================================
            // LEVEL 5: Пазл (The Puzzle)
            // Челендж: Лише дорогі вежі. Дуже короткий шлях.
            // Треба використати Bounty тайл на старті, інакше не вистачить грошей на фінал.
            // ============================================================
            {
                id: 'level_5',
                name: isUa ? '5. Екзамен' : '5. The Exam',
                description: isUa
                    ? 'Короткий шлях. Елітні вежі. Економіка вирішує все.'
                    : 'Short path. Elite towers. Economy is everything.',
                waveCount: 25,
                startingGold: 450, // Достатньо лише на одну круту вежу
                allowedTowers: [4, 6, 7], // Sniper, Prism, Poison (High Tier)
                mapLayout: 'static',
                difficulty: 'hard',
                xpReward: 50,
                gridSize: 10,
                healthMultiplier: 1.8,
                // Very short U-turn
                customPath: [
                    { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 },
                    { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
                    { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 }, { x: 5, y: 0 }
                ],
                bonusTiles: [
                    { x: 3, y: 4, type: 'bounty' }, // Ключ до перемоги. Треба поставити першу вежу тут.
                    { x: 4, y: 4, type: 'damage' }
                ]
            }
        ];
    }

    getLevel(id: string): LevelConfig | undefined {
        return this.levels.find(l => l.id === id);
    }

    getNextLevelId(currentId: string): string | null {
        const index = this.levels.findIndex(l => l.id === currentId);
        if (index >= 0 && index < this.levels.length - 1) {
            return this.levels[index + 1].id;
        }
        return null;
    }
}
