import { createContext, useContext, useState } from 'react';
import { useDispatch } from 'react-redux';
import { reorderVariables } from '../store/dash/variableContainers';

const DragContext = createContext(null);

export function DragProvider({ children, category }) {
    const dispatch = useDispatch();
    const [draggedIndex, setDraggedIndex] = useState(null);

    const handleDragStart = (index) => {
        setDraggedIndex(index);
    };

    const handleDrop = (dropIndex) => {
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            dispatch(reorderVariables({ category, fromIndex: draggedIndex, toIndex: dropIndex }));
        }
        setDraggedIndex(null);
    };

    const isDragging = (index) => draggedIndex === index;

    return (
        <DragContext.Provider value={{ handleDragStart, handleDrop, isDragging }}>
            {children}
        </DragContext.Provider>
    );
}

export function useDrag() {
    const context = useContext(DragContext);
    if (!context) {
        throw new Error('useDrag must be used within a DragProvider');
    }
    return context;
}
