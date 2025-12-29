import '../output.css'
import ThemeToggle from './ThemeToggle'
import Button from './Button'
import MessageList from './MessageList'

export default function Layout({ children, isLoggedIn, user, onLogin, onLogout }) {
    const handleAuthClick = () => {
        if (isLoggedIn) {
            onLogout();
        } else {
            onLogin();
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-theme-primary">
            <header className="text-4xl font-bold bg-theme-secondary text-theme-primary text-left p-4 border-b border-theme-primary flex justify-between items-center">
                <h1>InstaReport</h1>
                <div className="flex items-center space-x-3">
                    {isLoggedIn && user && (
                        <span className="text-sm font-normal text-theme-secondary">
                            Welcome, {user.username}
                        </span>
                    )}
                    <ThemeToggle className="text-sm" />
                    <Button
                        displayText={isLoggedIn ? 'Logout' : 'Login'}
                        onClick={handleAuthClick}
                        variant={isLoggedIn ? 'danger' : 'primary'}
                        size="small"
                    />
                </div>
            </header>
            <MessageList />
            <main className="flex-grow p-4 text-theme-primary">{children}</main>
            <footer className="bg-theme-secondary text-theme-secondary text-left p-4 border-t border-theme-primary">
                &copy; 2024 InstaReport
            </footer>
        </div>
    )
}