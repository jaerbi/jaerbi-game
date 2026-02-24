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
    bonusTiles?: { x: number; y: number; type: 'damage' | 'range' | 'bounty' | 'mastery' }[];
}

@Injectable({
    providedIn: 'root'
})
export class CampaignService {

    levels: LevelConfig[] = [
        {
            id: 'level_1',
            name: 'Training Grounds',
            description: 'Learn the basics. Only Turret and Cannon are available.',
            waveCount: 10,
            startingGold: 150,
            allowedTowers: [1, 2], // Ice, Lightning
            mapLayout: 'static',
            difficulty: 'easy',
            xpReward: 100,
            bonusTiles: [
                { x: 5, y: 5, type: 'damage' },
                { x: 14, y: 14, type: 'range' }
            ]
        },
        {
            id: 'level_2',
            name: 'The Chokepoint',
            description: 'Enemies come in numbers. Use splash damage.',
            waveCount: 15,
            startingGold: 200,
            allowedTowers: [1, 2, 3, 5], // + Shatter, Inferno
            mapLayout: 'static',
            difficulty: 'normal',
            xpReward: 250,
            bonusTiles: [
                { x: 10, y: 10, type: 'bounty' },
                { x: 8, y: 8, type: 'damage' }
            ]
        },
        {
            id: 'level_3',
            name: 'Prism Valley',
            description: 'Introduce the Prism Beam. High resistance enemies appear.',
            waveCount: 20,
            startingGold: 300,
            allowedTowers: [1, 2, 3, 4, 5, 6], // + Executioner, Prism
            mapLayout: 'static',
            difficulty: 'normal',
            xpReward: 500,
            bonusTiles: [
                { x: 10, y: 5, type: 'mastery' },
                { x: 5, y: 15, type: 'mastery' }
            ]
        },
        {
            id: 'level_4',
            name: 'Toxic Waste',
            description: 'Slimes and fast scouts. Neurotoxin unlocked.',
            waveCount: 25,
            startingGold: 350,
            allowedTowers: [1, 2, 3, 4, 5, 6, 7], // All
            mapLayout: 'static',
            difficulty: 'hard',
            xpReward: 800,
            bonusTiles: [
                { x: 10, y: 10, type: 'damage' },
                { x: 9, y: 10, type: 'range' }
            ]
        },
        {
            id: 'level_5',
            name: 'The Gauntlet',
            description: 'Survive the ultimate test.',
            waveCount: 30,
            startingGold: 400,
            allowedTowers: [1, 2, 3, 4, 5, 6, 7],
            mapLayout: 'static',
            difficulty: 'hard',
            xpReward: 1500,
            bonusTiles: [
                { x: 10, y: 10, type: 'bounty' },
                { x: 11, y: 10, type: 'bounty' },
                { x: 10, y: 11, type: 'bounty' },
                { x: 11, y: 11, type: 'bounty' }
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
