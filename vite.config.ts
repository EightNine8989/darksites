import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Dark Sites',
        short_name: 'DarkSites',
        description: 'Where to look, what to see — tonight.',
        theme_color: '#050811',
        background_color: '#02040a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'weather-api',
              expiration: { maxEntries: 50, maxAgeSeconds: 1800 }
            }
          }
        ]
      }
    })
  ],
  server: { port: 3000 }
});
