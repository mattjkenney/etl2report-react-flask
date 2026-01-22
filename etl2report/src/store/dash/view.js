import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    selectedBoundingBoxIds: [],
    hoveredBlockId: null,
    selectedBlockType: 'ALL',
};

const viewSlice = createSlice({
    name: 'view',
    initialState,
    reducers: {
        addBoundingBoxId: (state, action) => {
            const id = action.payload;
            if (!state.selectedBoundingBoxIds.includes(id)) {
                state.selectedBoundingBoxIds.push(id);
            }
        },
        removeBoundingBoxId: (state, action) => {
            state.selectedBoundingBoxIds = state.selectedBoundingBoxIds.filter(
                id => id !== action.payload
            );
        },
        clearBoundingBoxIds: (state) => {
            state.selectedBoundingBoxIds = [];
        },
        setHoveredBlockId: (state, action) => {
            state.hoveredBlockId = action.payload;
        },
        setSelectedBlockType: (state, action) => {
            state.selectedBlockType = action.payload;
        },
        reorderBoundingBoxIds: (state, action) => {
            const { fromIndex, toIndex } = action.payload;
            const items = [...state.selectedBoundingBoxIds];
            const [removed] = items.splice(fromIndex, 1);
            items.splice(toIndex, 0, removed);
            state.selectedBoundingBoxIds = items;
        },
        addManualInput: (state) => {
            // Generate a unique ID for manual inputs without bounding boxes
            const id = `manual-input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            state.selectedBoundingBoxIds.push(id);
        },
    },
});

export const { addBoundingBoxId, removeBoundingBoxId, clearBoundingBoxIds, setHoveredBlockId, setSelectedBlockType, reorderBoundingBoxIds, addManualInput } = viewSlice.actions;
export default viewSlice.reducer;
