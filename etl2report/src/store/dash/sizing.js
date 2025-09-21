import { createSlice } from '@reduxjs/toolkit'

const getDashboardHeight = () => {
    if (typeof window !== 'undefined') {
        // Use the exact same calculation as .dashboard-container class
        return window.innerHeight - 160;
    }
    return 600; // fallback for SSR
}

const initialState = {
    actionsWidth: 20,
    isResizing: false,
    documentHeight: 'auto',
    actionsDefaultHeight: getDashboardHeight()
}

const sizingSlice = createSlice({
    name: 'sizing',
    initialState,
    reducers: {
        setActionsWidth: (state, action) => {
            const { containerLeft, containerWidth, clientX } = action.payload;
            
            if (containerLeft !== undefined && containerWidth && clientX !== undefined) {
                // Calculate new width based on mouse position and container
                const newWidth = clientX - containerLeft;
                const newWidthPercent = (newWidth / containerWidth) * 100;
                
                // Apply constraints (between 10% and 90%)
                if (newWidthPercent > 10 && newWidthPercent < 90) {
                    state.actionsWidth = newWidthPercent;
                }
            } else {
                // Direct assignment if no calculation needed
                state.actionsWidth = action.payload;
            }
        },
        setIsResizing: (state, action) => {
            state.isResizing = action.payload
        },
        setDocumentHeight: (state, action) => {
            state.documentHeight = action.payload
        },
        setActionsDefaultHeight: (state, action) => {
            state.actionsDefaultHeight = action.payload
        },
        resetSizing: (state) => {
            Object.assign(state, initialState)
        }
    }
})

export const { 
    setActionsWidth, 
    setIsResizing, 
    setDocumentHeight, 
    setActionsDefaultHeight,
    resetSizing 
} = sizingSlice.actions

export default sizingSlice.reducer