import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    manuals: [],
    tables: [],
    graphs: [],
    images: [],
};

const variableContainersSlice = createSlice({
    name: 'variableContainers',
    initialState,
    reducers: {
        // Add a variable to a specific category
        addVariable: (state, action) => {
            const { category, id } = action.payload;
            if (state[category] && !state[category].includes(id)) {
                state[category].push(id);
            }
        },
        // Remove a variable from a specific category
        removeVariable: (state, action) => {
            const { category, id } = action.payload;
            if (state[category]) {
                state[category] = state[category].filter(varId => varId !== id);
            }
        },
        // Reorder variables within a category
        reorderVariables: (state, action) => {
            const { category, fromIndex, toIndex } = action.payload;
            if (state[category]) {
                const items = [...state[category]];
                const [removed] = items.splice(fromIndex, 1);
                items.splice(toIndex, 0, removed);
                state[category] = items;
            }
        },
        // Clear all variables in a specific category
        clearCategory: (state, action) => {
            const { category } = action.payload;
            if (state[category]) {
                state[category] = [];
            }
        },
        // Clear all variables in all categories
        clearAll: (state) => {
            state.manuals = [];
            state.tables = [];
            state.graphs = [];
            state.images = [];
        },
    },
});

export const { addVariable, removeVariable, reorderVariables, clearCategory, clearAll } = variableContainersSlice.actions;
export default variableContainersSlice.reducer;
