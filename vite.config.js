import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, './src/main.js'),
      output: {
        format: 'iife',
        dir: path.resolve(__dirname, './dist'),
        entryFileNames: 'lib.js',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});