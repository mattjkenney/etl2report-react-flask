import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

// Async thunk for login
export const loginUser = createAsyncThunk(
    'user/loginUser',
    async (loginData, { rejectWithValue }) => {
        try {
            console.log('Login attempt:', loginData)

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000))

            // For demo purposes, accept any login
            // In a real app, you would make an actual API call here
            const user = { username: loginData.username }

            return user
        } catch (error) {
            return rejectWithValue(error.message)
        }
    }
)

const initialState = {
    user: null,
    isLoggedIn: false,
    showLoginForm: false,
    showSignupForm: false,
    isLoading: false,
    error: null
}

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        showLogin: (state, action) => {
            state.showLoginForm = action.payload
            // Hide signup form when showing login
            if (action.payload) {
                state.showSignupForm = false
            }
        },
        showSignup: (state, action) => {
            state.showSignupForm = action.payload
            // Hide login form when showing signup
            if (action.payload) {
                state.showLoginForm = false
            }
        },
        logout: (state) => {
            Object.assign(state, initialState);
        },
        clearError: (state) => {
            state.error = null
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loginUser.pending, (state) => {
                state.isLoading = true
                state.error = null
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.isLoading = false
                state.user = action.payload
                state.isLoggedIn = true
                state.showLoginForm = false
                state.showSignupForm = false
                state.error = null
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
            })
    }
})

export const { showLogin, showSignup, logout, clearError } = userSlice.actions
export default userSlice.reducer