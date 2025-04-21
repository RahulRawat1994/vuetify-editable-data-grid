import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: './src/index.ts', // Your library's entry point
      name: 'VueCopyToClipboard',
      fileName: (format) => `vue-copy-to-clipboard.${format}.js`,
    },
    rollupOptions: {
      // Ensure external dependencies aren't bundled
      external: ['vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
      },
    },
  },
});