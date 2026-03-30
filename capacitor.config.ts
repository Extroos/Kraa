/// <reference types="@codetrix-studio/capacitor-google-auth" />
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kraa.app',
  appName: 'Kraa',
  webDir: 'dist',
  plugins: {
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "401470495679-07goo04ch37upuq3l3vcj76qg015fusf.apps.googleusercontent.com",
      forceCodeForRefreshToken: true
    }
  }
};

export default config;
