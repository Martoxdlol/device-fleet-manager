import { defineConfig, loadEnv, type Plugin } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { brandName } from './src/brand.ts'

function documentTitle(): Plugin {
    return {
        name: 'document-title',
        transformIndexHtml: (html) => html.replace('%BRAND_NAME%', brandName),
    }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
    const root = fileURLToPath(new URL('.', import.meta.url))
    if (command === 'build' && !loadEnv(mode, root, 'VITE_').VITE_FLEET_API_URL)
        throw new Error('Set VITE_FLEET_API_URL to the API origin this build calls.')
    return {
        plugins: [
            tailwindcss(),
            react(),
            babel({ presets: [reactCompilerPreset()] }),
            documentTitle(),
        ],
        resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    }
})
