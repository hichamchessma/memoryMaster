import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } })
const GOOGLE_WEB_CLIENT_ID = '423174493764-p43ot0q0ka2917p2hnjk866qnkj101pr.apps.googleusercontent.com'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_WEB_CLIENT_ID}>
    <QueryClientProvider client={qc}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'toast-gaming',
          style: { background: '#1a1a2e', color: '#f1f5f9', border: '1px solid rgba(124,58,237,0.4)' },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
    </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>
)
