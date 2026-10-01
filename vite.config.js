import { defineConfig } from 'vite';

// Served from sidharthpatel.com/projects/kalman-radar/, not the domain root,
// so every built asset reference needs this prefix baked in.
//
// Deliberately not "radar-tracker" (the original path): many ad/privacy
// blocklists (including Brave Shields) have generic rules blocking any URL
// containing "tracker", since that word is common in real tracking-pixel
// endpoints. That silently broke asset loading for visitors with those
// blockers on, with a different request failing unpredictably each load.
export default defineConfig({
  base: '/projects/kalman-radar/',
});
