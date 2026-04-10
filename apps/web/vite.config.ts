import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import svgr from 'vite-plugin-svgr';

/**
 * Vite config for the Pterodactyl Panel SPA.
 *
 * Notes:
 *  - We need a real Babel pass because the codebase uses twin.macro and
 *    babel-plugin-styled-components. @vitejs/plugin-react exposes a `babel`
 *    option that's piped through to babel core for every source file.
 *  - CSS is handled by the root postcss.config.cjs (Tailwind + nesting +
 *    preset-env). Vite reads it automatically.
 *  - SVG imports default to URL asset references. vite-plugin-svgr adds the
 *    `?react` suffix for JSX-style imports if any code ever needs them.
 */
export default defineConfig(({ mode }) => {
    return {
        plugins: [
            react({
                babel: {
                    plugins: [
                        'babel-plugin-macros',
                        [
                            'babel-plugin-styled-components',
                            {
                                // `pure: true` triggers a detector crash in babel-plugin-styled-components
                                // against the current Babel 7.29 traversal API. Re-enable once v3 lands.
                                displayName: true,
                                fileName: true,
                                ssr: false,
                            },
                        ],
                    ],
                },
            }),
            svgr({ include: '**/*.svg?react' }),
        ],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                '@definitions': path.resolve(__dirname, './src/api/definitions'),
                '@feature': path.resolve(__dirname, './src/components/server/features'),
            },
            // `styled-components-breakpoint` ships a nested install of
            // styled-components (peer range mismatch), which triggers
            // styled-components' "multiple instances" runtime warning and causes
            // ThemeProvider context to get lost. Force every import to resolve to
            // the single top-level copy.
            dedupe: ['styled-components', 'react', 'react-dom', 'easy-peasy', 'use-sync-external-store'],
        },
        optimizeDeps: {
            include: [
                'styled-components',
                'styled-components-breakpoint',
                'react',
                'react-dom',
                'react/jsx-runtime',
                'react/jsx-dev-runtime',
                'easy-peasy',
                'use-sync-external-store/shim/with-selector',
                'react-transition-group',
            ],
        },
        define: {
            // Legacy webpack.EnvironmentPlugin compatibility. Any code still reading
            // these at runtime sees the build-time values. Once React 19 lands we can
            // switch to import.meta.env everywhere and delete this block.
            'process.env.NODE_ENV': JSON.stringify(mode),
            'process.env.DEBUG': JSON.stringify(mode !== 'production'),
            'process.env.WEBPACK_BUILD_HASH': JSON.stringify(Date.now().toString(16)),
        },
        build: {
            outDir: 'dist',
            sourcemap: mode !== 'production',
            chunkSizeWarningLimit: 4096,
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ['react', 'react-dom', 'react-router-dom'],
                        charts: ['chart.js', 'react-chartjs-2'],
                        xterm: [
                            'xterm',
                            'xterm-addon-fit',
                            'xterm-addon-search',
                            'xterm-addon-search-bar',
                            'xterm-addon-unicode11',
                            'xterm-addon-web-links',
                        ],
                    },
                },
            },
        },
    };
});
