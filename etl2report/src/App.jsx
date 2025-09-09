import { useState } from 'react'
import Layout from './components/Layout'
import Login from './components/Login'
import Button from './components/Button'
import { useTheme } from './contexts/ThemeContext'

function App() {
  const [count, setCount] = useState(0)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [user, setUser] = useState(null)
  const [showLoginForm, setShowLoginForm] = useState(false)
  const { currentTheme } = useTheme()

  const handleLogin = async (loginData) => {
    // Simulate authentication
    console.log('Login attempt:', loginData)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // For demo purposes, accept any login
    setUser({ username: loginData.username })
    setIsLoggedIn(true)
    setShowLoginForm(false) // Hide login form after successful login
  }

  const handleShowLogin = () => {
    setShowLoginForm(true)
  }

  const handleSignup = () => {
    // Handle signup navigation or modal
    console.log('Signup clicked')
    alert('Signup functionality would redirect to signup page or open signup modal')
    // In a real app, you might:
    // - Navigate to a signup route
    // - Open a signup modal
    // - Switch to a signup component
  }

  const handleLogout = () => {
    setUser(null)
    setIsLoggedIn(false)
    setShowLoginForm(false)
  }

  return (
    <Layout 
      isLoggedIn={isLoggedIn}
      user={user}
      onLogin={handleShowLogin}
      onLogout={handleLogout}
    >
      <div className="space-y-6">
        
        {(!isLoggedIn && showLoginForm) ? (
          <div className="max-w-md mx-auto">
            <Login 
              onLogin={handleLogin} 
              onSignup={handleSignup}
            />
          </div>
        ) : isLoggedIn ? (
          <Dashboard></Dashboard>
        ) : (
          <div className="text-center">
            <p className="text-theme-secondary mb-4">
              Please log in to access your dashboard.
            </p>
            <Button
              displayText="Get Started"
              onClick={handleShowLogin}
              variant="primary"
              size="medium"
            />
          </div>
        )}
      </div>
    </Layout>
  )
}

export default App
