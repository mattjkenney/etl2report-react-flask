import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss()
    ],
    optimizeDeps: {
        include: ['pdfjs-dist']
    },
    assetsInclude: ['**/*.pdf'],
    define: {
        // This helps with PDF.js worker loading
        global: 'globalThis',
    },
    server: {
        fs: {
            allow: ['..']
        }
    },
    build: {
        rollupOptions: {
            output: {
                // Ensure PDF.js worker is handled correctly
                manualChunks: {
                    'pdfjs': ['pdfjs-dist']
                }
            }
        }
    }
})
