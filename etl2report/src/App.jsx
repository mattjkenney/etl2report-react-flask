import { useState } from 'react'
import Layout from './components/Layout'
import { useTheme } from './contexts/ThemeContext'

function App() {
  const [count, setCount] = useState(0)
  const { currentTheme } = useTheme()

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-theme-primary">Welcome to InstaReport</h1>
        
        <div className="bg-theme-secondary p-6 rounded-lg border border-theme-primary shadow-theme">
          <p className="text-theme-secondary mb-4">
            Current theme: <span className="font-semibold text-theme-primary">{currentTheme}</span>
          </p>
          
          <div className="space-y-4">
            <div className="bg-theme-tertiary p-4 rounded border border-theme-secondary">
              <h2 className="text-xl font-semibold text-theme-primary mb-2">Theme Demo</h2>
              <p className="text-theme-secondary">
                This component demonstrates the theme system with different background levels and text colors.
              </p>
            </div>
            
            <button 
              onClick={() => setCount(count + 1)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
            >
              Click count: {count}
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-theme-secondary p-4 rounded-lg border border-theme-primary shadow-theme">
            <h3 className="font-semibold text-theme-primary mb-2">Primary Colors</h3>
            <p className="text-theme-secondary">Background and text adapt to the selected theme.</p>
          </div>
          
          <div className="bg-theme-tertiary p-4 rounded-lg border border-theme-secondary shadow-theme">
            <h3 className="font-semibold text-theme-primary mb-2">Secondary Colors</h3>
            <p className="text-theme-muted">Tertiary background with muted text.</p>
          </div>
          
          <div className="bg-theme-secondary p-4 rounded-lg border border-theme-primary shadow-theme-lg">
            <h3 className="font-semibold text-theme-primary mb-2">Enhanced Shadow</h3>
            <p className="text-theme-secondary">This card uses the large theme-aware shadow.</p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default App
