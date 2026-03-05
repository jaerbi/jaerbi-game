import { Injectable } from '@angular/core';
import { SettingsService } from './settings.service';

export interface LevelConfig {
    id: string;
    name: string;
    description: string;
    waveCount: number;
    startingGold: number;
    allowedTowers: number[]; // Array of tower types (1-8)
    mapLayout?: 'static' | 'random';
    difficulty: 'easy' | 'normal' | 'hard';
    xpReward: number;
    bountyMultiplier?: number;
    masteriesEnabled?: boolean;
    gridSize?: number; // Custom grid size (e.g. 10, 12, 15)
    customPath?: { x: number; y: number }[]; // Explicit path coordinates
    bonusTiles?: { x: number; y: number; type: 'damage' | 'range' | 'prime' | 'bounty' | 'mastery' | 'speed' }[];
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
    // Type 1 (Ice) -> isFrost | base 15 | abilities price 60
    // Type 2 (Lightning) -> isGrounded | 50  | 200
    // Type 3 (Cannon) -> isAgile | 400 | 1600 
    // Type 4 (Sniper) -> isBulwark | 600 | 2400
    // Type 5 (Inferno) -> isMagma (AOE/Burn) | 500 | 1400 | 2000
    // Type 6 (Prism) -> isMirror | 500 | 1400 | 2000
    // Type 7 (Venom) -> isSlime (DoT) | 500 | 1400 | 2000
    // Type 8 (Earth) -> isLevitating  | 500 | 1400 | 2000

    //  const isVulnerable =
    //         (enemy.isFrost && towerType === 5) ||      // 1 Ice -> 5 Fire
    //         (enemy.isGrounded && towerType === 8) ||   // 2 Grounded -> 8 Earth
    //         (enemy.isAgile && towerType === 6) ||      // 3 Agile -> 6 Prism
    //         (enemy.isBulwark && towerType === 7) ||    // 4 Armored -> 7 Poison
    //         (enemy.isMagma && towerType === 1) ||      // 5 Magma -> 1 Ice
    //         (enemy.isMirror && towerType === 4) ||     // 6 Prism -> 4 Sniper
    //         (enemy.isSlime && towerType === 2) ||      // 7 Slime -> 2 Lightning
    //         (enemy.isLevitating && towerType === 3);   // 8 Levitation -> 3 Cannon



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
                healthMultiplier: 0.5,
                enemyTypes: ['Standard', 'Scout'],
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
                waveTypeSequence: [1, 1, 2, 1, 1, 2, 1, 1],
                waveModifiers: {
                    1: { count: 12 },
                    2: { count: 14, traits: [{ property: 'isFrost', chance: 0.1 }] },
                    3: { count: 20, traits: [{ property: 'isFrost', chance: 0.8 }] },
                    5: { count: 18, traits: [{ property: 'isFrost', chance: 0.5 }] },
                    6: { count: 25, traits: [{ property: 'isFrost', chance: 1 }] },
                    7: { count: 30, traits: [{ property: 'isFrost', chance: 0.6 }] },
                    8: { count: 38, traits: [{ property: 'isFrost', chance: 0.9 }] },
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
                masteriesEnabled: false,
                enemyTypes: ['Standard', 'Scout', 'Tank'],
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
                waveTypeSequence: [1, 1, 2, 3, 1, 2, 3, 1, 1, 3, 1, 3],
                waveModifiers: {
                    1: { count: 10 },
                    2: { count: 14, traits: [{ property: 'isFrost', chance: 0.2 }] },
                    3: { count: 30, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isGrounded', chance: 0.2 }] },//S
                    4: { count: 15 },//T
                    5: { count: 18, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.2 }] },
                    6: { count: 40, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isGrounded', chance: 0.4 }] },//S
                    7: { count: 20, traits: [{ property: 'isFrost', chance: 0.3 }, { property: 'isGrounded', chance: 0.5 }] },//T
                    8: { count: 30, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.2 }] },
                    9: { count: 35, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.6 }] },
                    10: { count: 30, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.6 }] },//T
                    11: { count: 45, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isGrounded', chance: 0.6 }] },
                    12: { count: 40, traits: [{ property: 'isFrost', chance: 0.3 }, { property: 'isGrounded', chance: 0.7 }] },//T
                }
            },
            {
                id: 'level_3',
                name: isUa ? '3. Снайперська Алея' : '3. Sniper Alley',
                description: isUa
                    ? 'Вороги тримають дистанцію. Займіть висоту і використовуйте радіус огляду.'
                    : 'Enemies keep their distance. Take the high ground and utilize range.',
                waveCount: 15,
                startingGold: 1050,
                allowedTowers: [3, 4], // Turret, Sniper
                mapLayout: 'static',
                difficulty: 'normal',
                xpReward: 30,
                gridSize: 15,
                bountyMultiplier: 3.5,
                healthMultiplier: 5,
                masteriesEnabled: false,
                enemyTypes: ['Standard', 'Scout', 'Tank'],
                bossCount: 3, // Waves 5, 10, 15
                //Large circle around the edges
                customPath: [
                    // TOP:
                    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 7, y: 0 }, { x: 8, y: 0 }, { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 11, y: 0 }, { x: 12, y: 0 }, { x: 13, y: 0 }, { x: 14, y: 0 },
                    // RIGHT:
                    { x: 14, y: 1 }, { x: 14, y: 2 }, { x: 14, y: 3 }, { x: 14, y: 4 }, { x: 14, y: 5 }, { x: 14, y: 6 }, { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 14, y: 9 }, { x: 14, y: 10 }, { x: 14, y: 11 }, { x: 14, y: 12 }, { x: 14, y: 13 }, { x: 14, y: 14 },
                    // BOTTOM: 
                    { x: 13, y: 14 }, { x: 12, y: 14 }, { x: 11, y: 14 }, { x: 10, y: 14 }, { x: 9, y: 14 }, { x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 }, { x: 5, y: 14 }, { x: 4, y: 14 }, { x: 3, y: 14 }, { x: 2, y: 14 }, { x: 1, y: 14 }, { x: 0, y: 14 },
                    // LEFT: 
                    { x: 0, y: 13 }, { x: 0, y: 12 }, { x: 0, y: 11 }, { x: 0, y: 10 }, { x: 0, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 7 }, { x: 0, y: 6 }, { x: 0, y: 5 }, { x: 0, y: 4 }, { x: 0, y: 3 }, { x: 0, y: 2 }, { x: 0, y: 1 }
                ],
                bonusTiles: [
                    { x: 4, y: 4, type: 'range' }, //sniper
                    { x: 3, y: 3, type: 'damage' }, //sniper
                    { x: 10, y: 4, type: 'range' }, //sniper
                    { x: 11, y: 3, type: 'damage' }, //sniper
                    { x: 4, y: 10, type: 'range' }, //sniper
                    { x: 3, y: 11, type: 'damage' }, //sniper
                    { x: 10, y: 10, type: 'range' }, //sniper
                    { x: 11, y: 11, type: 'damage' }, //sniper

                    { x: 7, y: 7, type: 'prime' }, //trap
                    { x: 9, y: 7, type: 'range' }, //trap
                    { x: 5, y: 7, type: 'range' }, //trap
                    { x: 7, y: 5, type: 'range' }, //trap
                    { x: 7, y: 9, type: 'range' }, //trap

                    { x: 13, y: 13, type: 'speed' }, //turret
                    { x: 13, y: 1, type: 'speed' }, //turret
                    { x: 1, y: 1, type: 'speed' }, //turret
                    { x: 1, y: 13, type: 'speed' }, //turret
                    // (not effective)
                ],
                waveTypeSequence: [1, 1, 2, 1, 2, 1, 3, 2, 1, 3, 2, 1, 3, 1, 3],
                waveModifiers: {
                    1: { count: 13 },
                    2: { count: 15 },
                    3: { count: 25, traits: [{ property: 'isAgile', chance: 0.4 }, { property: 'isBulwark', chance: 0.4 }] },//s
                    4: { count: 25, traits: [{ property: 'isAgile', chance: 0.4 }] },
                    5: { count: 30, traits: [{ property: 'isAgile', chance: 0.2 }, { property: 'isBulwark', chance: 0.2 }] },//s
                    6: { count: 28, traits: [{ property: 'isAgile', chance: 0.4 }, { property: 'isBulwark', chance: 0.4 }] },
                    7: { count: 25 },//T
                    8: { count: 40, traits: [{ property: 'isAgile', chance: 0.5 }, { property: 'isBulwark', chance: 0.5 }] },//s
                    9: { count: 34, traits: [{ property: 'isAgile', chance: 0.3 }, { property: 'isBulwark', chance: 0.4 }] },
                    10: { count: 28, traits: [{ property: 'isAgile', chance: 0.2 }, { property: 'isBulwark', chance: 0.2 }] },//t
                    11: { count: 45, traits: [{ property: 'isAgile', chance: 0.5 }, { property: 'isBulwark', chance: 0.5 }] },//s
                    12: { count: 38, traits: [{ property: 'isAgile', chance: 0.5 }, { property: 'isBulwark', chance: 0.5 }] },
                    13: { count: 35, traits: [{ property: 'isAgile', chance: 0.6 }, { property: 'isBulwark', chance: 0.3 }] },//t
                    14: { count: 45, traits: [{ property: 'isAgile', chance: 0.7 }, { property: 'isBulwark', chance: 0.3 }] },
                    15: { count: 50, traits: [{ property: 'isBulwark', chance: 0.6 }] },//T
                }
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
                bountyMultiplier: 0.6,
                healthMultiplier: 3,
                masteriesEnabled: false,
                enemyTypes: ['Standard', 'Scout', 'Tank'],
                bossCount: 2, // 5, 10, 15, 20
                // Zig-zag vertical
                customPath: [
                    { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 },
                    { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 },
                    { x: 4, y: 4 }, { x: 4, y: 5 }, { x: 4, y: 6 },
                    { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 7, y: 6 },
                    { x: 7, y: 7 }, { x: 7, y: 8 }, { x: 7, y: 9 }, { x: 7, y: 10 }, { x: 7, y: 11 }
                ],
                bonusTiles: [
                    { x: 5, y: 5, type: 'mastery' }, // best
                    { x: 2, y: 2, type: 'damage' }, // norm
                    { x: 8, y: 8, type: 'speed' }, // norm
                    { x: 5, y: 2, type: 'prime' }, // norm
                    { x: 3, y: 7, type: 'prime' }, // norm

                    { x: 0, y: 4, type: 'bounty' }, // trap
                    { x: 8, y: 5, type: 'bounty' }, // trap
                ],
                waveTypeSequence: [1, 1, 3, 1, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 3],
                waveModifiers: {
                    1: { count: 15 },
                    2: { count: 20 },
                    3: { count: 20, traits: [{ property: 'isFrost', chance: 0.2 }] },//t
                    4: { count: 30, traits: [{ property: 'isFrost', chance: 0.4 }] },
                    5: { count: 25, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isMagma', chance: 0.2 }] },//t
                    6: { count: 35, traits: [{ property: 'isFrost', chance: 0.4 }, { property: 'isMagma', chance: 0.4 }] },//s
                    7: { count: 35, traits: [{ property: 'isMagma', chance: 0.6 }] },//t
                    8: { count: 40, traits: [{ property: 'isFrost', chance: 0.6 }, { property: 'isMagma', chance: 0.4 }] },//s
                    9: { count: 35, traits: [{ property: 'isFrost', chance: 0.2 }, { property: 'isMagma', chance: 0.7 }] },//t
                    10: { count: 45, traits: [{ property: 'isMagma', chance: 1 }] },//s
                    11: { count: 38, traits: [{ property: 'isFrost', chance: 0.5 }, { property: 'isMagma', chance: 0.5 }] },//t
                    12: { count: 50, traits: [{ property: 'isMagma', chance: 1 }] },//s
                    13: { count: 40, traits: [{ property: 'isFrost', chance: 0.5 }, { property: 'isMagma', chance: 0.5 }] },//t
                    14: { count: 55, traits: [{ property: 'isFrost', chance: 1 }] },//s
                    15: { count: 42, traits: [{ property: 'isMagma', chance: 0.5 }] }, //t
                    16: { count: 60, traits: [{ property: 'isMagma', chance: 1 }] },//s
                    17: { count: 44, traits: [{ property: 'isMagma', chance: 0.8 }] },//t
                    18: { count: 65, traits: [{ property: 'isMagma', chance: 1 }] },//s
                    19: { count: 46, traits: [{ property: 'isMagma', chance: 0.8 }] },//t
                    20: { count: 50, traits: [{ property: 'isMagma', chance: 0.8 }] },//t
                }
            },
            {
                id: 'level_5',
                name: isUa ? '5. Екзамен' : '5. The Exam',
                description: isUa
                    ? 'Короткий шлях. Елітні вежі. Економіка вирішує все.'
                    : 'Short path. Elite towers. Economy is everything.',
                waveCount: 25,
                startingGold: 1250, // Only enough for one steeplechase
                allowedTowers: [4, 6, 7], // Sniper, Prism, Poison (High Tier)
                mapLayout: 'static',
                difficulty: 'hard',
                xpReward: 50,
                gridSize: 10,
                bountyMultiplier: 2.5,
                healthMultiplier: 8.5,
                masteriesEnabled: false,
                enemyTypes: ['Tank', 'Scout', 'Standard'],
                bossCount: 5, // 5, 10, 15, 20, 25
                // Very short U-turn
                customPath: [
                    { x: 3, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 3, y: 4 }, { x: 3, y: 5 },
                    { x: 4, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
                    { x: 6, y: 4 }, { x: 6, y: 3 }, { x: 6, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 0 }
                ],
                bonusTiles: [
                    { x: 4, y: 4, type: 'damage' },  // Norm
                    { x: 2, y: 0, type: 'speed' },   // Trap
                    { x: 7, y: 0, type: 'speed' },   // Trap
                    { x: 0, y: 3, type: 'prime' },   // best
                    { x: 9, y: 3, type: 'prime' },   // best
                    { x: 5, y: 3, type: 'mastery' }, // best
                    { x: 2, y: 6, type: 'bounty' },  // best
                    { x: 7, y: 6, type: 'bounty' },  // The key to victory is to place the first tower here.
                    { x: 3, y: 9, type: 'range' },   // norm
                    { x: 6, y: 9, type: 'range' },   // norm
                ],
                waveTypeSequence: [3, 3, 2, 3, 2, 1, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 3],
                waveModifiers: {
                    1: { count: 15 },//t
                    2: { count: 20 },//t
                    3: { count: 30, traits: [{ property: 'isBulwark', chance: 0.2 }, { property: 'isMirror', chance: 0.2 }, { property: 'isSlime', chance: 0.2 }] },//s
                    4: { count: 25, traits: [{ property: 'isMirror', chance: 0.4 }] },//t
                    5: { count: 25, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.2 }] },//s
                    6: { count: 35, traits: [{ property: 'isSlime', chance: 0.4 }, { property: 'isMirror', chance: 0.4 }] },
                    7: { count: 45, traits: [{ property: 'isMirror', chance: 0.8 }] },//s
                    8: { count: 40, traits: [{ property: 'isSlime', chance: 0.6 }, { property: 'isBulwark', chance: 0.4 }] },
                    9: { count: 28, traits: [{ property: 'isMirror', chance: 0.3 }, { property: 'isBulwark', chance: 0.5 }] },//t
                    10: { count: 50, traits: [{ property: 'isSlime', chance: 0.8 }] },//s
                    11: { count: 38, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.3 }] },
                    12: { count: 30, traits: [{ property: 'isBulwark', chance: 0.8 }] },//t
                    13: { count: 50, traits: [{ property: 'isBulwark', chance: 0.5 }, { property: 'isMirror', chance: 0.5 }] },//s
                    14: { count: 35, traits: [{ property: 'isSlime', chance: 0.4 }, { property: 'isMirror', chance: 0.4 }, { property: 'isBulwark', chance: 0.2 }] },
                    15: { count: 32, traits: [{ property: 'isMirror', chance: 0.8 }] }, //t
                    16: { count: 60, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.3 }] },//s
                    17: { count: 37, traits: [{ property: 'isSlime', chance: 0.1 }, { property: 'isBulwark', chance: 0.4 }] },
                    18: { count: 34, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isMirror', chance: 0.5 }] },//t
                    19: { count: 46, traits: [{ property: 'isSlime', chance: 0.4 }, { property: 'isMirror', chance: 0.2 }, { property: 'isBulwark', chance: 0.4 }] },//s
                    20: { count: 42, traits: [{ property: 'isBulwark', chance: 0.8 }] },
                    21: { count: 38, traits: [{ property: 'isSlime', chance: 0.2 }, { property: 'isBulwark', chance: 0.2 }, { property: 'isMirror', chance: 0.2 }] },//t
                    22: { count: 50, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.3 }] },//s
                    23: { count: 46, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.3 }] },
                    24: { count: 41, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.3 }] },//t
                    25: { count: 45, traits: [{ property: 'isSlime', chance: 0.3 }, { property: 'isBulwark', chance: 0.3 }, { property: 'isMirror', chance: 0.3 }] },//t
                }
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
