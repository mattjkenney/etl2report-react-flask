import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    hoveredBlockId: null,
    selectedBlockType: 'ALL',
    selectionMode: {
        enabled: false,
        targetInputId: null,
        templateName: null,
    },
};

const viewSlice = createSlice({
    name: 'view',
    initialState,
    reducers: {
        setHoveredBlockId: (state, action) => {
            state.hoveredBlockId = action.payload;
        },
        setSelectedBlockType: (state, action) => {
            state.selectedBlockType = action.payload;
        },
        setSelectionMode: (state, action) => {
            state.selectionMode = action.payload;
        },
    },
});

export const { setHoveredBlockId, setSelectedBlockType, setSelectionMode } = viewSlice.actions;
export default viewSlice.reducer;
