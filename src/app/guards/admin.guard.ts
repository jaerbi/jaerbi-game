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
        if (!isPlatformBrowser(this.platformId)) {
            return of(true);
        }

        return this.userStream$.pipe(
            // Чекаємо, поки Firebase перестане бути undefined (завантаження)
            filter(user => user !== undefined),
            take(1),
            map(user => {
                // Якщо user === null, значить Firebase точно сказав, що юзер НЕ залогінений
                if (!user && window.location.hostname !== 'localhost') {
                    console.warn('Redirect: User is not logged in at all');
                    return this.router.parseUrl('/');
                }

                const isAllowed = (user && this.ALLOWED_ADMINS.includes(user.uid)) ||
                    window.location.hostname === 'localhost';

                if (isAllowed) return true;

                return this.router.parseUrl('/');
            })
        );
    }
}
