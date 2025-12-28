import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

// Custom plugin to exclude dev files from production builds
const excludeDevFiles = () => {
    return {
        name: 'exclude-dev-files',
        writeBundle(options, bundle) {
            // Remove dev files from dist after they've been copied
            const distPath = options.dir || 'dist'
            const devPath = path.join(distPath, 'dev')
            const devFiles = ['button-demo.html', 'test-worker.html']

            // Remove individual dev files from dist root
            devFiles.forEach((file) => {
                const filePath = path.join(distPath, file)
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath)
                    console.log(`Removed dev file from production build: ${file}`)
                }
            })

            // Remove entire dev directory from dist
            if (fs.existsSync(devPath)) {
                fs.rmSync(devPath, { recursive: true, force: true })
                console.log('Removed dev directory from production build')
            }
        },
    }
}

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss(), excludeDevFiles()],
    optimizeDeps: {
        include: ['pdfjs-dist'],
    },
    assetsInclude: ['**/*.pdf'],
    define: {
        // This helps with PDF.js worker loading
        global: 'globalThis',
    },
    server: {
        fs: {
            allow: ['..'],
        },
    },
    build: {
        rollupOptions: {
            output: {
                // Ensure PDF.js worker is handled correctly
                manualChunks: {
                    pdfjs: ['pdfjs-dist'],
                },
            },
        },
    },
})
