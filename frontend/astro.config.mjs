import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
    integrations: [react()],

    // pre-built HTML (with support for interactive islands)
    // see 2026-04-16-hybrid-as-frontend-rendering
    output: 'static',

    // folder name, here 'dist/_assets/'
    build: {
        assets: '_assets',
    },
});
