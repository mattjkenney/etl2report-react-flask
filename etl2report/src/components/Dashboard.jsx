import Actions from './Actions'
import View from './View'
import { useState, useRef, useEffect, useCallback } from 'react';

export default function Dashboard() {
    const [actionsWidth, setActionsWidth] = useState(20);
    const [isResizing, setIsResizing] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [documentHeight, setDocumentHeight] = useState('auto');
    
    const containerRef = useRef(null);

    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (isResizing && containerRef.current) {
            const containerRect = containerRef.current.getBoundingClientRect();
            const newWidth = e.clientX - containerRect.left;
            const newWidthPercent = (newWidth / containerRect.width) * 100;
            
            if (newWidthPercent > 10 && newWidthPercent < 90) {
                setActionsWidth(newWidthPercent);
            }
        }
    }, [isResizing]);

    const handleMouseUp = useCallback(() => {
        setIsResizing(false);
    }, []);

    const handleDocumentHeightChange = useCallback((height) => {
        console.log('Dashboard received height:', height);
        setDocumentHeight(height);
    }, []);

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
    const dashboardMinHeight = documentHeight === 'auto' || documentHeight === null 
        ? '100vh' 
        : `${Math.max(documentHeight, 600)}px`; // Ensure minimum 600px height

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
                <Actions onFileSelect={setSelectedFile} selectedFile={selectedFile} />
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
                <View 
                    file={selectedFile} 
                    onDocumentHeightChange={handleDocumentHeightChange}
                />
            </div>
        </div>
    )
}