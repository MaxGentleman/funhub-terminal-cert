import { defineConfig } from 'vite';

// Plain HTML + JS, no framework. The whole point of this app is that a manager
// on a phone at the counter gets it in one paint.
export default defineConfig({
  build: { target: 'es2018', assetsInlineLimit: 0 }
});
