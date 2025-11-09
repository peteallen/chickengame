import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'spa',
  // Required so asset URLs resolve correctly when served from https://peteallen.github.io/chickengame/
  base: '/chickengame/'
});
