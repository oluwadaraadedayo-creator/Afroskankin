import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, readdirSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const rootDir = process.cwd();
const mediaExtensions = new Set([
  '.avif', '.gif', '.jpg', '.jpeg', '.png', '.svg', '.webp', '.mp4', '.webm',
]);

export default defineConfig({
  // This site is hosted at the root of westafricangoat.com.
  base: '/',
  plugins: [
    react(),
    {
      name: 'copy-root-media-to-dist',
      closeBundle() {
        const outputDir = resolve(rootDir, 'dist');
        for (const file of readdirSync(rootDir, { withFileTypes: true })) {
          if (!file.isFile() || !mediaExtensions.has(extname(file.name).toLowerCase())) {
            continue;
          }
          copyFileSync(resolve(rootDir, file.name), resolve(outputDir, file.name));
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        product: resolve(rootDir, 'product.html'),
        cart: resolve(rootDir, 'cart.html'),
      },
    },
  },
});
