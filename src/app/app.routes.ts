import { Routes } from '@angular/router';
import { AppGame } from './app-game';
import { FeedbackComponent } from './components/feedback/feedback.component';
import { RoadmapComponent } from './components/roadmap/roadmap.component';
import { LandingPageComponent } from './components/landing-page/landing-page.component';
import { TowerDefenseComponent } from './components/tower-defense/tower-defense.component';
import { TowerDefenseLeaderboardComponent } from './components/tower-defense-leaderboard/tower-defense-leaderboard.component';
import { MasteriesComponent } from './components/masteries/masteries.component';
import { canLeaveGameGuard } from './guards/can-leave-game-guard.guard';
import { AdminAnalyticsComponent } from './components/admin-analytics/admin-analytics.component';
import { AdminGuard } from './guards/admin.guard';
import { PrintComponent } from './components/print/print.component';
import { MizaelComponent } from './components/mizael/mizael.component';
import { GoltComponent } from './components/golt/golt.component';
import { ApplicationComponent } from './components/application/application.component';

export const routes: Routes = [
    {
        path: '',
        component: LandingPageComponent,
    },
    {
        path: 'admin/analytics',
        component: AdminAnalyticsComponent,
        // canActivate: [AdminGuard]
    },
    {
        path: 'shape-tactics',
        component: AppGame,
    },
    {
        path: 'tower-defense',
        component: TowerDefenseComponent,
        canDeactivate: [canLeaveGameGuard]
    },
    {
        path: 'tower-defense-leaderboard',
        component: TowerDefenseLeaderboardComponent,
    },
    {
        path: 'masteries',
        component: MasteriesComponent,
    },
    {
        path: 'print',
        component: PrintComponent,
    },
    {
        path: 'mizael',
        component: MizaelComponent,
    },
    {
        path: 'golt',
        component: GoltComponent,
    },
    {
        path: 'application',
        component: ApplicationComponent,
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
