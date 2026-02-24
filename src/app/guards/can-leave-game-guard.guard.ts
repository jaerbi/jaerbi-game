import { CanDeactivateFn } from '@angular/router';
import { TowerDefenseComponent } from '../components/tower-defense/tower-defense.component';

export const canLeaveGameGuard: CanDeactivateFn<TowerDefenseComponent> = (component) => {
    const hasTowers = component.tdEngine.getTowersRef().length > 0;
    const isPlaying = component.tdEngine.isWaveInProgress();

    if (hasTowers || isPlaying) {
        return confirm('Ви впевнені, що хочете вийти? Весь прогрес поточної гри буде втрачено.');
    }
    return true;
};
