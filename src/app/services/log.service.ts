import { Injectable, signal } from '@angular/core';

export interface LogEntry {
    text: string;
    color: 'text-green-400' | 'text-red-400' | 'text-yellow-300' | 'text-gray-200';
    type: 'combat' | 'other';
}

@Injectable({ providedIn: 'root' })
export class LogService {
    private entriesSignal = signal<LogEntry[]>([]);
    logs() {
        return this.entriesSignal();
    }
    add(text: string, color: LogEntry['color'] = 'text-gray-200') {
        this.entriesSignal.update(arr => [...arr, { text, color, type: 'other' }]);
    }
    addCombat(attackerOwner: 'player' | 'ai', formulaText: string, isCrit: boolean) {
        const color: LogEntry['color'] =
            isCrit ? 'text-yellow-300' : attackerOwner === 'player' ? 'text-green-400' : 'text-red-400';
        this.entriesSignal.update(arr => [...arr, { text: formulaText, color, type: 'combat' }]);
    }
    clear() {
        this.entriesSignal.set([]);
    }
}
