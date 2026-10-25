import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the static build can be hosted from any path (GitHub Pages, a sub-folder, or opened offline).
  base: './',
  test: { environment: 'node' },
});
