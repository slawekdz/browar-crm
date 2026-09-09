import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'pl.browarpogorza.crm',
  appName: 'Browar Pogorza CRM',
  webDir: 'dist-app',
  android: {
    backgroundColor: '#0f1218',
  },
  plugins: {
    // Dark chrome behind light status-bar icons; insets reach the page as env(safe-area-inset-*).
    SystemBars: { style: 'DARK', insetsHandling: 'css' },
  },
};

export default config;
