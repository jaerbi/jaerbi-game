import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FirebaseService } from '../services/firebase.service';

export const authGuard: CanActivateFn = () => {
    const firebase = inject(FirebaseService);
    const router = inject(Router);
    const user = firebase.user$();
    if (user) return true;
    return router.createUrlTree(['']);
};
