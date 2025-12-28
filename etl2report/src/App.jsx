import { useSelector, useDispatch } from 'react-redux'
import Layout from './components/Layout'
import Login from './components/Login'
import Button from './components/Button'
import Dashboard from './components/Dashboard'
import { showLogin, logoutUser } from './store/auth/index.js'
import ButtonDemo from './components/ButtonDemo'

function App() {
    const dispatch = useDispatch()
    const { user, isLoggedIn, showLoginForm } = useSelector(state => state.auth.user)

    const handleShowLogin = () => {
        dispatch(showLogin(true))
    }

    const handleLogout = () => {
        dispatch(logoutUser())
    }

    return (
        <Layout
            isLoggedIn={isLoggedIn}
            user={user}
            onLogin={handleShowLogin}
            onLogout={handleLogout}
        >
            {(!isLoggedIn && showLoginForm) ? (
                <div className="space-y-6">
                    <div className="max-w-md mx-auto">
                        <Login />
                    </div>
                </div>
            ) : isLoggedIn ? (
                <Dashboard />
            ) : (
                <div className="space-y-6">
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
                </div>
            )}
        </Layout>
    )
}

export default App
