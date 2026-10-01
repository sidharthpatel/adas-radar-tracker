import { defineConfig } from 'vite';

// Served from sidharthpatel.com/projects/radar-tracker/, not the domain root,
// so every built asset reference needs this prefix baked in.
export default defineConfig({
  base: '/projects/radar-tracker/',
});
