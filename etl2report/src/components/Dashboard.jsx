import Actions from './Actions'
import View from './View'

export default function Dashboard() {
    return (
        <div className="flex w-full gap-4 dashboard-container">
            {/* Actions component - 20% width */}
            <div className="flex-shrink-0 dashboard-actions">
                <Actions />
            </div>
            
            {/* View component - 80% width */}
            <div className="flex-grow dashboard-view">
                <View />
            </div>
        </div>
    )
}