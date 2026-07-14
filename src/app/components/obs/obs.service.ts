import { Injectable } from '@angular/core';
import { FirebaseService } from '../../services/firebase.service';

@Injectable({ providedIn: 'root' })
export class ScoreService {

    constructor(

        private firebaseService: FirebaseService,
    ) { }

   // Зберігаємо дані в Firebase
    async saveData(data: any) {
        await this.firebaseService.updateScore(data);
    }

    // Отримуємо актуальні дані безпосередньо з Firebase (асинхронно)
    async getLatestData() {
        // Тут краще використовувати getDoc з Firestore
        return await this.firebaseService.getCurrentScore();
    }
}
