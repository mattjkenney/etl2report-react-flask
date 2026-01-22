import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Cache of manual input states keyed by templateId, then by input id
    // Structure: { templateId: { inputId: { ...inputState } } }
    cache: {},
};

// Helper function to get default state for a manual input
const getDefaultInputState = () => ({
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
});

const manualInputSlice = createSlice({
    name: 'manualInput',
    initialState,
    reducers: {
        // Initialize or get cached state for a manual input
        initializeInput: (state, action) => {
            const { templateId, inputId } = action.payload;
            if (!state.cache[templateId]) {
                state.cache[templateId] = {};
            }
            if (!state.cache[templateId][inputId]) {
                state.cache[templateId][inputId] = getDefaultInputState();
            }
        },
        // Update a specific field for a manual input
        updateField: (state, action) => {
            const { templateId, inputId, field, value } = action.payload;
            if (!state.cache[templateId]) {
                state.cache[templateId] = {};
            }
            if (!state.cache[templateId][inputId]) {
                state.cache[templateId][inputId] = getDefaultInputState();
            }
            state.cache[templateId][inputId][field] = value;
        },
        // Update multiple fields at once for a manual input
        updateFields: (state, action) => {
            const { templateId, inputId, fields } = action.payload;
            if (!state.cache[templateId]) {
                state.cache[templateId] = {};
            }
            if (!state.cache[templateId][inputId]) {
                state.cache[templateId][inputId] = getDefaultInputState();
            }
            Object.keys(fields).forEach(field => {
                state.cache[templateId][inputId][field] = fields[field];
            });
        },
        // Clear the cache for a specific manual input
        clearInput: (state, action) => {
            const { templateId, inputId } = action.payload;
            if (state.cache[templateId]) {
                delete state.cache[templateId][inputId];
            }
        },
        // Clear all inputs for a specific template
        clearTemplateInputs: (state, action) => {
            const { templateId } = action.payload;
            delete state.cache[templateId];
        },
        // Clear all cached inputs across all templates
        clearAllInputs: (state) => {
            state.cache = {};
        },
        // Remove a specific input from cache (alias for clearInput)
        removeInput: (state, action) => {
            const { templateId, inputId } = action.payload;
            if (state.cache[templateId]) {
                delete state.cache[templateId][inputId];
            }
        },
    },
});

export const { 
    initializeInput, 
    updateField, 
    updateFields, 
    clearInput, 
    clearTemplateInputs,
    clearAllInputs,
    removeInput 
} = manualInputSlice.actions;

// Selectors
export const selectInputState = (state, templateId, inputId) => {
    return state.manualInput.cache[templateId]?.[inputId] || getDefaultInputState();
};

export const selectTemplateInputs = (state, templateId) => {
    return state.manualInput.cache[templateId] || {};
};

export const selectAllInputs = (state) => state.manualInput.cache;

export default manualInputSlice.reducer;
