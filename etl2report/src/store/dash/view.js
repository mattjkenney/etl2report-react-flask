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
    },
});

export const { addBoundingBoxId, removeBoundingBoxId, clearBoundingBoxIds, setHoveredBlockId, setSelectedBlockType } = viewSlice.actions;
export default viewSlice.reducer;
