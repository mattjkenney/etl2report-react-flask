import { combineReducers } from '@reduxjs/toolkit'
import userReducer from './user.js'
import loginReducer from './login.js'
import signupReducer from './signup.js'

const authReducer = combineReducers({
    user: userReducer,
    login: loginReducer,
    signup: signupReducer
})

export default authReducer

// Re-export actions for convenience
export { 
    showLogin, 
    showSignup, 
    resetState,
    clearError, 
    loginUser,
    logoutUser,
    loginSuccess,
    loginFailure 
} from './user.js'
export { 
    updateFormData, 
    setFormErrors, 
    clearFormErrors, 
    resetFormData,
    validateAndSetErrors,
    validateLoginForm,
    selectIsFormValid,
    clearGeneralError,
    setGeneralError
} from './login.js'