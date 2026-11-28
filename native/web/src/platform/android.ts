import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { getState, setState } from '../app/store';
import { backAction } from './back-policy';

export function installAndroid() {
  if (Capacitor.getPlatform() !== 'android') return;
  document.documentElement.dataset.platform = 'android';
  App.addListener('backButton', ({ canGoBack }) => {
    const s = getState();
    const action = backAction({ inside: !!document.querySelector('.wander-stage.is-inside'), search: s.searchOpen, inspector: !!s.inspector, lens: s.lensOpen, canGoBack, route: location.hash.replace(/^#\//, '') || 'today' });
    if (action === 'painting') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    else if (action === 'search') setState({ searchOpen: false });
    else if (action === 'inspector') setState({ inspector: null });
    else if (action === 'lens') setState({ lensOpen: false });
    else if (action === 'history') history.back();
    else if (action === 'home') location.replace('#/today');
    else void App.minimizeApp();
  });
}
