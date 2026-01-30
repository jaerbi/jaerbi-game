import { Routes } from '@angular/router';
import { AppGame } from './app-game';
import { FeedbackComponent } from './components/feedback/feedback.component';
import { RoadmapComponent } from './components/roadmap/roadmap.component';

export const routes: Routes = [
    {
        path: '',
        component: AppGame,
    },
    {
        path: 'feedback',
        component: FeedbackComponent
    },
    {
        path: 'roadmap',
        component: RoadmapComponent
    }
];
