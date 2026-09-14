import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './profile.css'
import './question-bank.css'
import 'katex/dist/katex.min.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <React.Suspense fallback={<div className="app-loading" aria-label="Loading" />}>
      <App />
    </React.Suspense>
  </React.StrictMode>,
)
