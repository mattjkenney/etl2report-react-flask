import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Cache of variable states keyed by sectionId, templateId, then item id
    // Structure: { sectionId: { templateId: { itemId: { ...itemState } } } }
    cache: {},
};

// Default state configurations for each section type
const defaultStateConfigs = {
    manuals: () => ({
        name: '',
        type: '',
        prompt: '',
        helpText: '',
        previewValue: '',
        precision: '',
        min: '',
        max: '',
        allowInequalities: false,
        inequalityOperator: '=',
        roundingType: 'none',
        sigFigs: '',
        rounding: '',
        formattedValue: '',
    }),
    tables: () => ({
        name: '',
        headers: [],
        rows: [],
        styling: {},
    }),
    graphs: () => ({
        name: '',
        chartType: '',
        data: [],
        options: {},
    }),
    images: () => ({
        name: '',
        url: '',
        alt: '',
        width: '',
        height: '',
    }),
};

// Helper function to get default state based on section type
const getDefaultStateForSection = (sectionId) => {
    const config = defaultStateConfigs[sectionId];
    return config ? config() : {};
};

const variableSlice = createSlice({
    name: 'variables',
    initialState,
    reducers: {
        // Initialize or get cached state for a variable
        initializeItem: (state, action) => {
            const { sectionId, templateId, itemId, initialValues = {} } = action.payload;
            if (!state.cache[sectionId]) {
                state.cache[sectionId] = {};
            }
            if (!state.cache[sectionId][templateId]) {
                state.cache[sectionId][templateId] = {};
            }
            if (!state.cache[sectionId][templateId][itemId]) {
                state.cache[sectionId][templateId][itemId] = {
                    ...getDefaultStateForSection(sectionId),
                    ...initialValues
                };
            }
        },
        // Update a specific field for a variable
        updateField: (state, action) => {
            const { sectionId, templateId, itemId, field, value } = action.payload;
            if (!state.cache[sectionId]) {
                state.cache[sectionId] = {};
            }
            if (!state.cache[sectionId][templateId]) {
                state.cache[sectionId][templateId] = {};
            }
            if (!state.cache[sectionId][templateId][itemId]) {
                state.cache[sectionId][templateId][itemId] = getDefaultStateForSection(sectionId);
            }
            state.cache[sectionId][templateId][itemId][field] = value;
        },
        // Update multiple fields at once for a variable
        updateFields: (state, action) => {
            const { sectionId, templateId, itemId, fields } = action.payload;
            if (!state.cache[sectionId]) {
                state.cache[sectionId] = {};
            }
            if (!state.cache[sectionId][templateId]) {
                state.cache[sectionId][templateId] = {};
            }
            if (!state.cache[sectionId][templateId][itemId]) {
                state.cache[sectionId][templateId][itemId] = getDefaultStateForSection(sectionId);
            }
            Object.keys(fields).forEach(field => {
                state.cache[sectionId][templateId][itemId][field] = fields[field];
            });
        },
        // Clear the cache for a specific item
        clearItem: (state, action) => {
            const { sectionId, templateId, itemId } = action.payload;
            if (state.cache[sectionId]?.[templateId]) {
                delete state.cache[sectionId][templateId][itemId];
            }
        },
        // Clear all items for a specific template in a section
        clearTemplateItems: (state, action) => {
            const { sectionId, templateId } = action.payload;
            if (state.cache[sectionId]) {
                delete state.cache[sectionId][templateId];
            }
        },
        // Clear all items in a specific section
        clearSection: (state, action) => {
            const { sectionId } = action.payload;
            delete state.cache[sectionId];
        },
        // Clear all cached items across all sections
        clearAll: (state) => {
            state.cache = {};
        },
        // Remove a specific item from cache (alias for clearItem)
        removeItem: (state, action) => {
            const { sectionId, templateId, itemId } = action.payload;
            if (state.cache[sectionId]?.[templateId]) {
                delete state.cache[sectionId][templateId][itemId];
            }
        },
    },
});

export const { 
    initializeItem, 
    updateField, 
    updateFields, 
    clearItem, 
    clearTemplateItems,
    clearSection,
    clearAll,
    removeItem 
} = variableSlice.actions;

// Selectors
export const selectItemState = (state, sectionId, templateId, itemId) => {
    return state.variables.cache[sectionId]?.[templateId]?.[itemId] || getDefaultStateForSection(sectionId);
};

export const selectTemplateItems = (state, sectionId, templateId) => {
    return state.variables.cache[sectionId]?.[templateId] || {};
};

export const selectSectionItems = (state, sectionId) => {
    return state.variables.cache[sectionId] || {};
};

export const selectAllItems = (state) => state.variables.cache;

export default variableSlice.reducer;
