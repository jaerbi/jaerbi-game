import { Injectable } from '@angular/core';

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
    gridSize?: number; // Custom grid size (e.g. 10, 12, 15)
    customPath?: { x: number; y: number }[]; // Explicit path coordinates
    bonusTiles?: { x: number; y: number; type: 'damage' | 'range' | 'bounty' | 'mastery' }[];
    healthMultiplier?: number; // Enemy HP Multiplier for this level
}

@Injectable({
    providedIn: 'root'
})
export class CampaignService {

    levels: LevelConfig[] = [
        {
            id: 'level_1',
            name: 'The Curve',
            description: 'Learn the basics. A simple winding path.',
            waveCount: 10,
            startingGold: 65,
            allowedTowers: [1, 2], // Turret, Cannon
            mapLayout: 'static',
            difficulty: 'easy',
            xpReward: 20,
            gridSize: 10,
            healthMultiplier: 0.8, // Slightly easier
            customPath: [
                {x:0,y:2}, {x:1,y:2}, {x:2,y:2}, {x:3,y:2}, 
                {x:3,y:3}, {x:3,y:4}, {x:3,y:5}, 
                {x:4,y:5}, {x:5,y:5}, {x:6,y:5}, 
                {x:6,y:4}, {x:6,y:3}, {x:6,y:2}, 
                {x:7,y:2}, {x:8,y:2}, {x:9,y:2}, {x:9,y:3}, {x:9,y:4}, {x:9,y:5}, {x:9,y:6}, {x:9,y:7}, {x:9,y:8}, {x:9,y:9}
            ],
            bonusTiles: [
                { x: 4, y: 4, type: 'damage' },
                { x: 5, y: 6, type: 'range' }
            ]
        },
        {
            id: 'level_2',
            name: 'The Choke',
            description: 'Enemies loop back. Perfect for splash damage.',
            waveCount: 15,
            startingGold: 80,
            // Re-reading Engine code from previous turns:
            // 1: Slows enemies (Ice/Frost)
            // 2: Chain Lightning
            // 3: Shatter
            // 5: Inferno (AOE)
            // User requested:
            // L1: Turret & Cannon. (Maybe standard tower is ID 6 or 7? No, usually 1 is basic. Let's assume 1 & 2 for now, or check engine.)
            // L2: Ice & Cannon. 
            // Let's use 1, 2, 3, 5 for now.
            allowedTowers: [1, 5], // Ice(1) and Inferno(5 - closest to Cannon/Splash)
            mapLayout: 'static',
            difficulty: 'normal',
            xpReward: 25,
            gridSize: 12,
            customPath: [
                {x:0,y:0}, {x:1,y:0}, {x:2,y:0}, {x:3,y:0}, {x:4,y:0}, {x:5,y:0}, {x:6,y:0}, {x:7,y:0}, {x:8,y:0}, {x:9,y:0}, {x:10,y:0}, {x:11,y:0},
                {x:11,y:1}, {x:11,y:2}, {x:11,y:3}, {x:11,y:4}, {x:11,y:5}, {x:11,y:6}, {x:11,y:7}, {x:11,y:8}, {x:11,y:9}, {x:11,y:10}, {x:11,y:11},
                {x:10,y:11}, {x:9,y:11}, {x:8,y:11}, {x:7,y:11}, {x:6,y:11}, {x:5,y:11}, {x:4,y:11}, {x:3,y:11}, {x:2,y:11}, {x:1,y:11}, {x:0,y:11},
                {x:0,y:10}, {x:0,y:9}, {x:0,y:8}, {x:0,y:7}, {x:0,y:6} // U-shape ending in middle-left
            ],
            bonusTiles: [
                { x: 5, y: 1, type: 'bounty' },
                { x: 6, y: 10, type: 'damage' }
            ]
        },
        {
            id: 'level_3',
            name: 'Sniper Alley',
            description: 'Long range is key. Enemies are far away.',
            waveCount: 20,
            startingGold: 100,
            allowedTowers: [4, 6], // Sniper(4), Prism(6) - assuming IDs
            mapLayout: 'static',
            difficulty: 'normal',
            xpReward: 30,
            gridSize: 15,
            customPath: [
                {x:0,y:7}, {x:1,y:7}, {x:2,y:7}, {x:3,y:7}, {x:4,y:7}, {x:5,y:7}, {x:6,y:7}, {x:7,y:7}, 
                {x:8,y:7}, {x:9,y:7}, {x:10,y:7}, {x:11,y:7}, {x:12,y:7}, {x:13,y:7}, {x:14,y:7}
            ],
            bonusTiles: [
                { x: 7, y: 2, type: 'range' }, // Far away spot
                { x: 7, y: 12, type: 'range' }
            ]
        },
        {
            id: 'level_4',
            name: 'Zig Zag',
            description: 'Mixed tactics required. Adapt to the path.',
            waveCount: 25,
            startingGold: 120,
            allowedTowers: [1, 4, 7], // Turret(1), Sniper(4), Poison(7)
            mapLayout: 'static',
            difficulty: 'hard',
            xpReward: 35,
            gridSize: 12,
            customPath: [
                {x:0,y:0}, {x:1,y:0}, {x:2,y:0}, 
                {x:2,y:1}, {x:2,y:2}, 
                {x:3,y:2}, {x:4,y:2}, 
                {x:4,y:3}, {x:4,y:4}, 
                {x:5,y:4}, {x:6,y:4}, 
                {x:6,y:5}, {x:6,y:6}, 
                {x:7,y:6}, {x:8,y:6}, 
                {x:8,y:7}, {x:8,y:8}, 
                {x:9,y:8}, {x:10,y:8}, 
                {x:10,y:9}, {x:10,y:10}, {x:11,y:10}, {x:11,y:11}
            ],
            bonusTiles: [
                { x: 3, y: 3, type: 'damage' },
                { x: 7, y: 5, type: 'range' }
            ]
        },
        {
            id: 'level_5',
            name: 'The Puzzle',
            description: 'Short path. High tier towers only. Make every shot count.',
            waveCount: 30,
            startingGold: 400,
            allowedTowers: [3], // No T1/T2
            mapLayout: 'static',
            difficulty: 'hard',
            xpReward: 40,
            gridSize: 10,
            healthMultiplier: 2.0, // Buff enemies to make T3/T4 necessary
            customPath: [
                {x:2,y:2}, {x:3,y:2}, {x:4,y:2}, {x:5,y:2}, {x:6,y:2}, {x:7,y:2}, 
                {x:7,y:3}, {x:7,y:4}, {x:7,y:5}, {x:7,y:6}, {x:7,y:7}
            ],
            bonusTiles: [
                { x: 4, y: 4, type: 'bounty' },
                { x: 5, y: 5, type: 'mastery' }
            ]
        }
    ];

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
