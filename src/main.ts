import App from './App.svelte'
import './app.css'

const app = new App({
  target: document.getElementById('app')!
})

if (!import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
}

export default app
