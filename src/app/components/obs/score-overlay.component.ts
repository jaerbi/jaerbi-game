import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // <-- 1. Додаємо ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { FirebaseService } from '../../services/firebase.service';

@Component({
    selector: 'app-score-overlay',
    imports: [CommonModule],
    templateUrl: 'score-overlay.component.html',
    styleUrl: 'score-overlay.component.css',
})
export class ScoreOverlayComponent implements OnInit {
    score = { wins: 0, draws: 0, losses: 0 };
    animating = { wins: false, draws: false, losses: false };
    currentText = '';
    mode: 'score' | 'text' = 'score';
    private unsubscribe: any;
    private messages: string[] = [
        "Ну що, вже програв ферзя? 👑",
        "А ви вже підписались на канал? 🔔",
        "Ну таку гру можна і віддячити донатом! ☕",
        "Це був геніальний хід чи черговий blunder? 🤔",
        "Час поставити лайк цьому стріму! 👍",
        "Тут пахне матом у 4 ходи... ☠️",

        "Не blunder, а хитрий тактичний задум! 😉",
        "Мій внутрішній Стокфіш у паніці... 🤖",
        "Здається, суперник думає довше, ніж триває цей стрім ⏳",
        "Хід конем — завжди гарна ідея (ні) 🐴",
        "Знову провтик фігури? Та ні, то тактична жертва! 🧠",
        "Час для довгої рокіровки в захист... 🏰",
        "Хто знайде найкращий хід у чаті — отримає повагу! 👑",

        "А ви вже підписались на канал? 🔔",
        "Ну таку гру можна і віддячити донатом! ☕",
        "Час поставити лайк цьому стріму! 👍",
        "Якість моєї гри росте пропорційно кількості лайків 📈",
        "Донат на каву гросмейстеру покращує тактичний зір! ☕",
        "Напиши свій варіант ходу в чат! 💬",
        "Підписка на канал додає +100 до рейтингу FIDE 🚀",

        "Аналітики в чаті, ваш вихід! 🧠",
        "У чаті знову зібралися одні гросмейстери? 😎",
        "Тут гаряче, як на лінії E! 🔥",
        "Дивишся без підписки? Суперник забере твою пішку! ♟️"
    ];
    private messageInterval: any;
    private restoreTimeout: any;

    constructor(
        private firebaseService: FirebaseService,
        private cdr: ChangeDetectorRef
    ) { }


    ngOnInit() {
        this.unsubscribe = this.firebaseService.subscribeToScore((newData) => {
            const keys = ['wins', 'draws', 'losses'] as const;

            keys.forEach(key => {
                if (this.score[key] !== newData[key]) {
                    this.triggerAnimation(key);
                    this.cdr.markForCheck();
                }
            });

            this.score = newData;
            this.cdr.detectChanges();
        });

        this.startMessageCycle();
    }

    startMessageCycle() {
        // 5 хвилин = 300000 мс
        this.messageInterval = setInterval(() => {
            this.showRandomMessage();
        }, 150000);
    }

    showRandomMessage() {
        // Вибираємо випадковий текст
        const randomIndex = Math.floor(Math.random() * this.messages.length);
        this.currentText = this.messages[randomIndex];

        // Перемикаємося в режим тексту
        this.mode = 'text';
        this.cdr.detectChanges();

        // Через 15 секунд повертаємо рахунок назад
        this.restoreTimeout = setTimeout(() => {
            this.mode = 'score';
            this.cdr.detectChanges();
        }, 15000); // 15 секунд показу повідомлення
    }

    triggerAnimation(key: keyof typeof this.animating) {
        // Якщо раптом горить текст, примусово повертаємо рахунок при зміні балів
        if (this.mode === 'text') {
            this.mode = 'score';
            if (this.restoreTimeout) clearTimeout(this.restoreTimeout);
        }

        this.animating[key] = false;

        setTimeout(() => {
            this.animating[key] = true;
            this.cdr.detectChanges();

            setTimeout(() => {
                this.animating[key] = false;
                this.cdr.detectChanges();
            }, 500);
        }, 50);
    }

    ngOnDestroy() {
        if (this.unsubscribe) this.unsubscribe();
        if (this.messageInterval) clearInterval(this.messageInterval);
        if (this.restoreTimeout) clearTimeout(this.restoreTimeout);
    }
}
