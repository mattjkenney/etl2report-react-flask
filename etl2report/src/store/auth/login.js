import { createSlice, createSelector } from '@reduxjs/toolkit'

const initialState = {
    formData: {
        username: '',
        password: ''
    },
    formErrors: {}
}

// Validation function
export const validateLoginForm = (formData) => {
    const errors = {}
    
    if (!formData.username.trim()) {
        errors.username = 'Username is required'
    }
    
    if (!formData.password) {
        errors.password = 'Password is required'
    } else if (formData.password.length < 6) {
        errors.password = 'Password must be at least 6 characters'
    }
    
    return {
        errors,
        isValid: Object.keys(errors).length === 0
    }
}

const loginSlice = createSlice({
    name: 'login',
    initialState,
    reducers: {
        updateFormData: (state, action) => {
            const { name, value } = action.payload
            state.formData[name] = value
            
            // Clear field error when user starts typing
            if (state.formErrors[name]) {
                delete state.formErrors[name]
            }
        },
        setFormErrors: (state, action) => {
            state.formErrors = action.payload
        },
        clearFormErrors: (state) => {
            state.formErrors = {}
        },
        resetFormData: (state) => {
            state.formData = initialState.formData
            state.formErrors = {}
        },
        validateAndSetErrors: (state) => {
            const { errors } = validateLoginForm(state.formData)
            state.formErrors = errors
        },
        clearGeneralError: (state) => {
            if (state.formErrors.general) {
                delete state.formErrors.general
            }
        },
        setGeneralError: (state, action) => {
            state.formErrors = { ...state.formErrors, general: action.payload }
        }
    }
})

// Selector to check if form is valid
export const selectIsFormValid = createSelector(
    [(state) => state.auth.login.formData],
    (formData) => validateLoginForm(formData).isValid
)

export const { 
    updateFormData, 
    setFormErrors, 
    clearFormErrors, 
    resetFormData,
    validateAndSetErrors,
    clearGeneralError,
    setGeneralError
} = loginSlice.actions

export default loginSlice.reducer