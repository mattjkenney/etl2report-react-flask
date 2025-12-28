import Actions from './Actions'
import View from './View'
import { useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActionsWidth, setIsResizing } from '../store/dash/sizing.js';

export default function Dashboard() {
    const dispatch = useDispatch();
    const { actionsWidth, isResizing } = useSelector(state => state.sizing);
    
    const containerRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        dispatch(setIsResizing(true));
    }, [dispatch]);

    const handleMouseMove = useCallback((e) => {
        if (isResizing && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            dispatch(setActionsWidth({ 
                containerLeft: containerRect.left,
                containerWidth: containerRect.width,
                clientX: e.clientX 
            }));
        }
    }, [isResizing, dispatch]);

    const handleMouseUp = useCallback(() => {
        dispatch(setIsResizing(false));
    }, [dispatch]);

    useEffect(() => {
        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, handleMouseMove, handleMouseUp]);

    // Calculate dashboard minimum height
    const dashboardMinHeight = 'auto';

    return (
        <div 
            ref={containerRef} 
            className="flex dashboard-container"
            style={{ 
                minHeight: dashboardMinHeight
            }}
        >
            {/* Actions component */}
            <div 
                className="flex-shrink-0" 
                style={{ width: actionsWidth + '%' }}
            >
                <Actions />
            </div>
            
            {/* Resize handle */}
            <div 
                className={`resize-handle ${isResizing ? 'active' : ''}`}
                title="Drag to resize"
                onMouseDown={handleMouseDown}
            ></div>
            
            {/* View component */}
            <div 
                className="flex-grow"
            >
                <View />
            </div>
        </div>
    )
}