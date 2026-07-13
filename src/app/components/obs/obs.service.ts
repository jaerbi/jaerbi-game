import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ScoreService {
  // BehaviorSubject зберігає останнє значення
  private scoreSubject = new BehaviorSubject({ wins: 0, draws: 0, losses: 0 });
  score$ = this.scoreSubject.asObservable();
  private STORAGE_KEY = 'chess_score';

  update(newScore: any) {
    this.scoreSubject.next(newScore);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(newScore));
  }
  getData() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : { wins: 0, draws: 0, losses: 0 };
  }
  saveData(data: any) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    // Додаємо подію, щоб оверлей дізнався про зміну без перезавантаження
    window.dispatchEvent(new Event('storage'));
  }
}
