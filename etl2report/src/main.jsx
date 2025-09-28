import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
//import './index.css'
import App from './App.jsx'
import ThemeProvider from './contexts/ThemeContext.jsx'
import { store } from './store/index.js'
import { configureCognito } from './config/cognito.js'

// Initialize Amplify configuration
configureCognito()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Provider>
  </StrictMode>,
)
