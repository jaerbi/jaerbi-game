import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

export interface LevelConfig {
    id: string;
    name: string;
    description: string;
    waveCount: number;
    startingGold: number;
    allowedTowers: number[]; // Array of tower types (1-7)
    mapLayout?: 'static' | 'random';
    difficulty: 'easy' | 'normal' | 'hard';
    xpReward: number;
    bountyMultiplier?: number;
    masteriesEnabled?: boolean;
    gridSize?: number; // Custom grid size (e.g. 10, 12, 15)
    customPath?: { x: number; y: number }[]; // Explicit path coordinates
    bonusTiles?: { x: number; y: number; type: 'damage' | 'range' | 'bounty' | 'mastery' | 'speed' }[];
    healthMultiplier?: number; // Enemy HP Multiplier for this level
    enemyTypes?: string[]; // E.g. ['Standard', 'Magma', 'Mirror']
    waveTypeSequence?: number[]; // 1=Standard, 2=Scout, 3=Tank, 4=Boss
    bossCount?: number; // Number of bosses to spawn during the campaign
    waveModifiers?: {
        [waveIndex: number]: {
            count?: number;
            masteryOverride?: boolean;
            traits?: Array<{
                property: 'isFrost' | 'isGrounded' | 'isAgile' | 'isBulwark' | 'isMagma' | 'isMirror' | 'isSlime';
                chance: number;
            }>;
        }
    };
}

@Injectable({
    providedIn: 'root'
})
export class CampaignService {

    levels: LevelConfig[] = [];

    // TOWER IDs REFERENCE:
    // Type 1 (Ice) -> isFrost | base 15 | full price (4lvl) 41 | abilities price 60
    // Type 2 (Lightning) -> isGrounded | 50 | 140 | 200
    // Type 3 (Cannon) -> isAgile | 250 | 700 | 1000 
    // Type 4 (Sniper) -> isBulwark | 500 | 1400 | 2000
    // Type 5 (Inferno) -> isMagma (AOE/Burn) | 500 | 1400 | 2000
    // Type 6 (Prism) -> isMirror | 500 | 1400 | 2000
    // Type 7 (Venom) -> isSlime (DoT) | 500 | 1400 | 2000


    constructor(private _settings: SettingsService) { this.initLevels(); }

    private initLevels(): void {
        const isUa = this._settings.currentLang() === 'uk';

        this.levels = [
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
                bountyMultiplier: 0.3,
                masteriesEnabled: false,
                healthMultiplier: 0.6,
                enemyTypes: ['Standard', 'Scout'],
                waveTypeSequence: [1, 1, 2, 1, 1, 2, 1, 1],
                bossCount: 1, // Only at the end
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
                ],
                waveModifiers: {
                    2: { count: 14, traits: [{ property: 'isFrost', chance: 0.2 }] },
                    3: { count: 15, traits: [{ property: 'isFrost', chance: 0.8 }] },
                    5: { count: 20, traits: [{ property: 'isFrost', chance: 0.4 }] },
                    6: { count: 25, traits: [{ property: 'isFrost', chance: 1 }] },
                    7: { count: 35, traits: [{ property: 'isFrost', chance: 0.8 }] },
                    8: { count: 40, traits: [{ property: 'isFrost', chance: 1 }] },
                }
            },
            {
                id: 'level_2',
                name: isUa ? '2. Вузький Прохід' : '2. The Choke',
                description: isUa
                    ? 'Вороги йдуть групами. Використовуйте Башні з AoE, щоб знищити їх разом.'
                    : 'Enemies swarm together. Use AoE damage to wipe them out at once.',
                waveCount: 12,
                startingGold: 60,
                allowedTowers: [1, 2],
                mapLayout: 'static',
                difficulty: 'normal',
                xpReward: 25,
                gridSize: 12,
                healthMultiplier: 1.1,
                bountyMultiplier: 0.5,
                enemyTypes: ['Standard', 'Tank'],
                waveTypeSequence: [1, 1, 2, 3, 1, 2, 3, 1, 1, 3, 1, 3],
                bossCount: 2, // Wave 6 and 12
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
                    { x: 2, y: 1, type: 'damage' }, // Perfect for a cannon, hits 3 lines
                    { x: 7, y: 5, type: 'bounty' }  // For the greedy
                ],
                waveModifiers: {
                    2: { count: 14, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.2 }] },
                    3: { count: 18, traits: [{ property: 'isFrost', chance: 0.8 }, { property: 'isGrounded', chance: 0.2 }] },
                    4: { count: 15 },
                    5: { count: 20, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.4 }] },
                    6: { count: 25, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isGrounded', chance: 0.6 }] },
                    7: { count: 25, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.5 }] },
                    8: { count: 25, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.2 }] },
                    9: { count: 35, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isGrounded', chance: 0.4 }] },
                    10: { count: 30, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isGrounded', chance: 0.4 }] },
                    11: { count: 40, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isGrounded', chance: 0.4 }] },
                    12: { count: 50, traits: [{ property: 'isFrost', chance: 0.1 }, { property: 'isGrounded', chance: 0.8 }] },
                }
            },
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
                healthMultiplier: 1.2,
                enemyTypes: ['Standard', 'Scout', 'Tank'],
                waveTypeSequence: [1, 1, 2, 1, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2],
                bossCount: 3, // Waves 5, 10, 15
                //Large circle around the edges
                customPath: [
                    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
                    { x: 14, y: 1 }, { x: 14, y: 2 }, { x: 14, y: 3 }, { x: 14, y: 4 }, { x: 14, y: 5 }, { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 14, y: 9 }, { x: 14, y: 10 }, { x: 14, y: 11 }, { x: 14, y: 12 }, { x: 14, y: 13 }, { x: 14, y: 14 },
                    { x: 13, y: 14 } // Exit
                ],
                bonusTiles: [
                    { x: 12, y: 2, type: 'range' }, // CENTER. The sniper here covers huge area.
                    { x: 12, y: 14, type: 'speed' }, // trap (not effective) 
                    { x: 1, y: 2, type: 'damage' } // trap (not effective)
                ]
            },
            {
                id: 'level_4',
                name: isUa ? '4. Вогонь і Лід' : '4. Fire and Ice',
                description: isUa
                    ? 'Вороги занадто живучі. Сповільніть їх, щоб вони згоріли.'
                    : 'Enemies are tough. Slow them down so they burn to ashes.',
                waveCount: 20,
                startingGold: 350,
                allowedTowers: [1, 5], // Ice, Inferno
                mapLayout: 'static',
                difficulty: 'hard',
                xpReward: 40,
                gridSize: 12,
                healthMultiplier: 1.5, // Дуже живучі
                enemyTypes: ['Standard', 'Tank', 'Scout'],
                waveTypeSequence: [1, 1, 3, 1, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2],
                bossCount: 4, // 5, 10, 15, 20
                // Zig-zag vertical
                customPath: [
                    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 },
                    { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
                    { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
                    { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
                    { x: 7, y: 7 }, { x: 7, y: 8 }, { x: 7, y: 9 }, { x: 7, y: 10 }, { x: 7, y: 11 }
                ],
                bonusTiles: [
                    { x: 2, y: 2, type: 'mastery' }, // norm
                    { x: 5, y: 5, type: 'damage' }, // norm
                    { x: 8, y: 8, type: 'speed' } // norm
                ]
            },
            {
                id: 'level_5',
                name: isUa ? '5. Екзамен' : '5. The Exam',
                description: isUa
                    ? 'Короткий шлях. Елітні вежі. Економіка вирішує все.'
                    : 'Short path. Elite towers. Economy is everything.',
                waveCount: 25,
                startingGold: 500, // Only enough for one steeplechase
                allowedTowers: [4, 6, 7], // Sniper, Prism, Poison (High Tier)
                mapLayout: 'static',
                difficulty: 'hard',
                xpReward: 50,
                gridSize: 10,
                healthMultiplier: 1.8,
                enemyTypes: ['Tank', 'Scout', 'Standard'],
                waveTypeSequence: [3, 3, 2, 3, 2, 1, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2],
                bossCount: 5, // 5, 10, 15, 20, 25
                // Very short U-turn
                customPath: [
                    { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 },
                    { x: 3, y: 5 }, { x: 4, y: 5 }, { x: 5, y: 5 },
                    { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }, { x: 5, y: 1 }, { x: 5, y: 0 }
                ],
                bonusTiles: [
                    { x: 3, y: 4, type: 'damage' }, //Norm
                    { x: 4, y: 4, type: 'bounty' },//The key to victory is to place the first tower here.
                    { x: 1, y: 1, type: 'speed' } // Trap
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
