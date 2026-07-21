import { initRouter } from './router.js';
import { initShell } from './shell.js';
import { initFirebase } from '../services/firebase-config.js';

async function bootstrap() {
  const config = await fetch('./config/app-config.json').then((r) => r.json());

  // Global services are initialized exactly once here, per architecture rule #5.
  initFirebase();
  initShell(config);
  initRouter(config);
}

bootstrap().catch((err) => {
  console.error('App failed to start', err);
  const outlet = document.getElementById('page-outlet');
  if (outlet) {
    outlet.innerHTML =
      '<div class="error-banner">應用程式初始化失敗，請重新整理頁面。</div>';
  }
});
