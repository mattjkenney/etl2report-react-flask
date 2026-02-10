import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    // Maps inputId to its formatted preview value
    // Structure: { inputId: formattedValue }
    formattedValues: {},
    
    // Maps bounding box ID (blockId) to the formatted value it should display
    // Structure: { blockId: formattedValue }
    boxToValueMap: {},
};

const previewValuesSlice = createSlice({
    name: 'previewValues',
    initialState,
    reducers: {
        // Set the formatted preview value for an input
        setFormattedValue: (state, action) => {
            const { inputId, value } = action.payload;
            state.formattedValues[inputId] = value;
        },
        
        // Update the formatted value for an input and propagate to its bound boxes
        updateFormattedValue: (state, action) => {
            const { inputId, value, boundBoxIds = [] } = action.payload;
            
            // Update the input's formatted value
            state.formattedValues[inputId] = value;
            
            // Update all bounding boxes that are bound to this input
            boundBoxIds.forEach(boxId => {
                state.boxToValueMap[boxId] = value;
            });
        },
        
        // Bind a formatted value to a specific bounding box
        bindValueToBox: (state, action) => {
            const { boxId, value } = action.payload;
            state.boxToValueMap[boxId] = value;
        },
        
        // Sync formatted value from input to its bound boxes (using bindings from boxBindings store)
        syncValueToBoxes: (state, action) => {
            const { inputId, boundBoxIds } = action.payload;
            const value = state.formattedValues[inputId];
            
            if (value !== undefined) {
                boundBoxIds.forEach(boxId => {
                    state.boxToValueMap[boxId] = value;
                });
            }
        },
        
        // Remove formatted value for an input
        removeFormattedValue: (state, action) => {
            const { inputId } = action.payload;
            delete state.formattedValues[inputId];
        },
        
        // Unbind a value from a bounding box
        unbindValueFromBox: (state, action) => {
            const { boxId } = action.payload;
            delete state.boxToValueMap[boxId];
        },
        
        // Remove all box mappings for boxes that were bound to a specific input
        clearBoxMappingsForInput: (state, action) => {
            const { boundBoxIds } = action.payload;
            boundBoxIds.forEach(boxId => {
                delete state.boxToValueMap[boxId];
            });
        },
        
        // Clear all formatted values
        clearAllFormattedValues: (state) => {
            state.formattedValues = {};
        },
        
        // Clear all box mappings
        clearAllBoxMappings: (state) => {
            state.boxToValueMap = {};
        },
        
        // Clear everything
        clearAll: (state) => {
            state.formattedValues = {};
            state.boxToValueMap = {};
        },
    },
});

export const {
    setFormattedValue,
    updateFormattedValue,
    bindValueToBox,
    syncValueToBoxes,
    removeFormattedValue,
    unbindValueFromBox,
    clearBoxMappingsForInput,
    clearAllFormattedValues,
    clearAllBoxMappings,
    clearAll,
} = previewValuesSlice.actions;

// Selectors
export const selectFormattedValue = (state, inputId) => {
    return state.previewValues.formattedValues[inputId] || '';
};

export const selectBoxValue = (state, boxId) => {
    return state.previewValues.boxToValueMap[boxId] || '';
};

export const selectAllFormattedValues = (state) => {
    return state.previewValues.formattedValues;
};

export const selectAllBoxMappings = (state) => {
    return state.previewValues.boxToValueMap;
};

// Get all box IDs that have values mapped
export const selectMappedBoxIds = (state) => {
    return Object.keys(state.previewValues.boxToValueMap);
};

// Check if a box has a value mapped
export const selectIsBoxMapped = (state, boxId) => {
    return boxId in state.previewValues.boxToValueMap;
};

export default previewValuesSlice.reducer;
