import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.playall365.app',
  appName: 'Playall 365',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#06080d",
      showSpinner: true,
      androidSpinnerStyle: "large",
      spinnerColor: "#f59e0b",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
