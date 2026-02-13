import { Routes } from '@angular/router';
import { AppGame } from './app-game';
import { FeedbackComponent } from './components/feedback/feedback.component';
import { RoadmapComponent } from './components/roadmap/roadmap.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { NewGamePlaceholderComponent } from './components/new-game-placeholder/new-game-placeholder.component';

export const routes: Routes = [
    {
        path: '',
        component: LandingPageComponent,
    },
    {
        path: 'shape-tactics',
        component: AppGame,
    },
    {
        path: 'new-game',
        component: NewGamePlaceholderComponent,
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
