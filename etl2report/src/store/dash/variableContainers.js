import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    manuals: {
        variableIds: [],
        title: 'Manual',
        variablePrefix: 'Manual variable'
    },
    tables: {
        variableIds: [],
        title: 'Tables',
        variablePrefix: 'Table variable'
    },
    graphs: {
        variableIds: [],
        title: 'Graphs',
        variablePrefix: 'Graph variable'
    },
    images: {
        variableIds: [],
        title: 'Images',
        variablePrefix: 'Image variable'
    },
};

const variableContainersSlice = createSlice({
    name: 'variableContainers',
    initialState,
    reducers: {
        // Add a variable to a specific category
        addVariable: (state, action) => {
            const { category, id } = action.payload;
            if (state[category] && !state[category].variableIds.includes(id)) {
                state[category].variableIds.push(id);
            }
        },
        // Remove a variable from a specific category
        removeVariable: (state, action) => {
            const { category, id } = action.payload;
            if (state[category]) {
                state[category].variableIds = state[category].variableIds.filter(varId => varId !== id);
            }
        },
        // Reorder variables within a category
        reorderVariables: (state, action) => {
            const { category, fromIndex, toIndex } = action.payload;
            if (state[category]) {
                const items = [...state[category].variableIds];
                const [removed] = items.splice(fromIndex, 1);
                items.splice(toIndex, 0, removed);
                state[category].variableIds = items;
            }
        },
        // Clear all variables in a specific category
        clearCategory: (state, action) => {
            const { category } = action.payload;
            if (state[category]) {
                state[category].variableIds = [];
            }
        },
        // Clear all variables in all categories
        clearAll: (state) => {
            state.manuals.variableIds = [];
            state.tables.variableIds = [];
            state.graphs.variableIds = [];
            state.images.variableIds = [];
        },
    },
});

export const { addVariable, removeVariable, reorderVariables, clearCategory, clearAll } = variableContainersSlice.actions;

// Selectors
export const selectSections = (state) => {
    return Object.keys(state.variableContainers).map((key) => ({
        id: key,
        title: state.variableContainers[key].title,
        variablePrefix: state.variableContainers[key].variablePrefix
    }));
};

export default variableContainersSlice.reducer;
