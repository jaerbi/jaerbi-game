import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { AppGame } from './app-game';
import { FeedbackComponent } from './components/feedback/feedback.component';

export const routes: Routes = [
    {
        path: '',
        component: AppGame,
    },
    {
        path: 'feedback',
        component: FeedbackComponent,
        canActivate: [authGuard]
    }
];
