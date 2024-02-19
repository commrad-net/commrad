import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`,
  },
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
      'react': 'preact/compat',
      'react-dom': 'preact/compat'
    },
  },
});