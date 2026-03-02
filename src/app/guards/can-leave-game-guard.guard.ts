import { CanDeactivateFn } from '@angular/router';
import { TowerDefenseComponent } from '../components/tower-defense/tower-defense.component';

export const canLeaveGameGuard: CanDeactivateFn<TowerDefenseComponent> = (component) => {
    return component.canResetOrLeave();
};
