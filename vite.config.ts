import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig(({ command }) => ({
  base: command === 'serve' ? '/' : '/DalePlayer/',
  plugins: [svelte()],
  worker: {
    format: 'es'
  },
  server: {
    allowedHosts: ['57e0-95-121-91-10.ngrok-free.app']
  }
}))
