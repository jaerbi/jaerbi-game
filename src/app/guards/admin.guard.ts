import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, filter, map, take, of } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class AdminGuard implements CanActivate {
    // 1. Використовуємо inject() для уникнення помилок ініціалізації
    private firebase = inject(FirebaseService);
    private router = inject(Router);
    private platformId = inject(PLATFORM_ID);

    // 2. Список довірених UID (твої "ключі від міста")
    private readonly ALLOWED_ADMINS = [
        'CknIzJbGE3ffWWrzM4fWgZvzpLk2', // jaerbi
        'S3Rek5fUgrTHtcKENOkHAl1mXCn2', // Serhii
    ];

    // 3. Перетворюємо сигнал у потік один раз при створенні класу
    private userStream$ = toObservable(this.firebase.user$);

    canActivate(): Observable<boolean | UrlTree> {
        // 4. Захист від SSR: на сервері просто пропускаємо, перевірка відбудеться в браузері
        if (!isPlatformBrowser(this.platformId)) {
            return of(true);
        }

        return this.userStream$.pipe(
            // 5. КЛЮЧОВИЙ МОМЕНТ: Чекаємо, поки Firebase вийде зі стану 'undefined'
            // Ми ігноруємо початковий стан завантаження
            filter(user => user !== undefined),
            take(1),
            map(user => {
                // ТИМЧАСОВО: Дозволяємо доступ, якщо ми на localhost
                const isLocalhost = window.location.hostname === 'localhost';
                const isAllowed = (user && this.ALLOWED_ADMINS.includes(user.uid)) || isLocalhost;

                if (isAllowed) {
                    console.log('✅ Доступ дозволено (Localhost або Admin)');
                    return true;
                }

                return this.router.parseUrl('/');
            })
        );
    }
}
