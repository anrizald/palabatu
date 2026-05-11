import './index.css'
import App from './App.js'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './lib/AuthContext.js';

// guard clause if root null at runtime
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

ReactDOM.createRoot(rootElement).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
)

const updateSW = registerSW({
  onNeedRefresh() {
    // You can later add a prompt here asking users to refresh when there's an update
    console.log('New content available, please refresh.')
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})