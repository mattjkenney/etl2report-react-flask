import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Mapping of inputId to array of blockIds
    // Structure: { inputId: [blockId1, blockId2, ...] }
    bindings: {},
};

const boxBindingsSlice = createSlice({
    name: 'boxBindings',
    initialState,
    reducers: {
        // Set binding for an input (appends to existing bindings)
        setBinding: (state, action) => {
            const { inputId, blockId } = action.payload;
            if (!state.bindings[inputId]) {
                state.bindings[inputId] = [];
            }
            if (!state.bindings[inputId].includes(blockId)) {
                state.bindings[inputId].push(blockId);
            }
        },
        // Add a blockId to an input's bindings (supports multiple boxes)
        addBinding: (state, action) => {
            const { inputId, blockId } = action.payload;
            if (!state.bindings[inputId]) {
                state.bindings[inputId] = [];
            }
            if (!state.bindings[inputId].includes(blockId)) {
                state.bindings[inputId].push(blockId);
            }
        },
        // Remove a specific blockId from an input's bindings
        removeBlockBinding: (state, action) => {
            const { inputId, blockId } = action.payload;
            if (state.bindings[inputId]) {
                state.bindings[inputId] = state.bindings[inputId].filter(id => id !== blockId);
                // Clean up empty arrays
                if (state.bindings[inputId].length === 0) {
                    delete state.bindings[inputId];
                }
            }
        },
        // Remove all bindings for an input
        removeBinding: (state, action) => {
            const { inputId } = action.payload;
            delete state.bindings[inputId];
        },
        // Clear all bindings
        clearAllBindings: (state) => {
            state.bindings = {};
        },
    },
});

export const { 
    setBinding,
    addBinding,
    removeBlockBinding,
    removeBinding,
    clearAllBindings 
} = boxBindingsSlice.actions;

// Selectors
export const selectBinding = (state, inputId) => {
    return state.boxBindings.bindings[inputId] || [];
};

export const selectAllBindings = (state) => state.boxBindings.bindings;

// Helper to get the first (primary) blockId for an input
export const selectPrimaryBlockId = (state, inputId) => {
    const bindings = state.boxBindings.bindings[inputId];
    return bindings && bindings.length > 0 ? bindings[0] : null;
};

export default boxBindingsSlice.reducer;
