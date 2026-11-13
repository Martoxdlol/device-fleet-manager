import { defineConfig, type Plugin } from 'vite'
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

export default defineConfig({
    plugins: [tailwindcss(), react(), babel({ presets: [reactCompilerPreset()] }), documentTitle()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { proxy: { '/api': process.env.FLEET_DEV_API ?? 'http://localhost:3000' } },
})
