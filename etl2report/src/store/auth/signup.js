import { createSlice } from '@reduxjs/toolkit'

// Placeholder for signup slice
// This will contain signup form state, validation, and submission logic

const initialState = {
    formData: {
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    },
    formErrors: {},
    isLoading: false
}

const signupSlice = createSlice({
    name: 'signup',
    initialState,
    reducers: {
        // TODO: Implement signup reducers
        // updateFormData
        // setFormErrors
        // clearFormErrors
        // resetFormData
    },
    // eslint-disable-next-line no-unused-vars
    extraReducers: (_builder) => {
        // TODO: Handle signup async thunk cases
        // signupUser.pending
        // signupUser.fulfilled
        // signupUser.rejected
    }
})

// eslint-disable-next-line no-empty-pattern
export const {
    // TODO: Export signup actions
} = signupSlice.actions

export default signupSlice.reducer