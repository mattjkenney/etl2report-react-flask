import '../output.css'
import ThemeToggle from './ThemeToggle'

export default function Layout({ children }) {
    return (
        <div className="min-h-screen flex flex-col bg-theme-primary">
            <header className="text-4xl font-bold bg-theme-secondary text-theme-primary text-left p-4 border-b border-theme-primary flex justify-between items-center">
                <h1>InstaReport</h1>
                <ThemeToggle className="text-sm" />
            </header>
            <main className="flex-grow p-4 text-theme-primary">{children}</main>
            <footer className="bg-theme-secondary text-theme-secondary text-left p-4 border-t border-theme-primary">
                &copy; 2024 InstaReport
            </footer>
        </div>
    )
}