// https://vitejs.dev/config/
const tailwindcss = require('@tailwindcss/vite')

module.exports = {
  plugins: [tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
}
