import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    reportFile: null, // Will store metadata: { name, size, type, lastModified }
    templateName: '',
    description: ''
}

const newTemplateSlice = createSlice({
    name: 'newTemplate',
    initialState,
    reducers: {
        setReportFile: (state, action) => {
            // Now receiving metadata directly instead of File object
            state.reportFile = action.payload
        },
        setTemplateName: (state, action) => {
            state.templateName = action.payload
        },
        setDescription: (state, action) => {
            state.description = action.payload
        },
        updateFormField: (state, action) => {
            const { name, value } = action.payload
            state[name] = value
        },
        resetForm: (state) => {
            Object.assign(state, initialState)
        }
    }
})

export const { 
    setReportFile, 
    setTemplateName, 
    setDescription, 
    updateFormField, 
    resetForm 
} = newTemplateSlice.actions

export default newTemplateSlice.reducer