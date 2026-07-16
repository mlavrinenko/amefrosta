import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves the project at /<repo>/. Change if the repo is renamed.
// Used for build AND preview so the preview mirrors production; dev also serves
// under this base, which is harmless.
const BASE = '/amefrosta/';

export default defineConfig(({ command }) => ({
  base: BASE,
  plugins: [
    react(),
    // Dev serves over HTTPS with a self-signed cert so that a phone reaching
    // the LAN address gets a secure context — required for the camera scanner
    // (navigator.mediaDevices) and crypto APIs. Accept the cert warning once.
    ...(command === 'serve' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Amefrosta — A Message from the Stars helper',
        short_name: 'Amefrosta',
        description: 'Offline helper for the board game A Message from the Stars',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
}));
