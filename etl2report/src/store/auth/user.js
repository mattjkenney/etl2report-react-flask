import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { signIn, fetchAuthSession, signOut, getCurrentUser } from 'aws-amplify/auth'

// Helper function to handle sign out
const forceSignOut = async () => {
    try {
        await signOut({ global: true });
    } catch (error) {
        console.log('Error during force sign out:', error);
    }
};

// Async thunk for logout
export const logoutUser = createAsyncThunk(
    'user/logoutUser',
    async (_, { rejectWithValue }) => {
        try {
            await signOut({ global: true });
            return null;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// Async thunk for login
export const loginUser = createAsyncThunk(
    'user/loginUser',
    async (loginData, { rejectWithValue }) => {
        try {
            const { username, password } = loginData
            
            try {
                // Check if there's already a signed-in user
                await getCurrentUser();
                // If we get here, there is a user signed in, so sign them out
                await forceSignOut();
            } catch (error) {
                // No user is signed in, which is what we want
                console.log('No current user, proceeding with sign in');
            }
            
            // Sign in with AWS Cognito
            const { isSignedIn, nextStep } = await signIn({ username, password })
            
            if (isSignedIn) {
                // Get the current session
                const session = await fetchAuthSession()
                
                // Return the user data we need
                const user = {
                    username,
                    token: session.tokens.accessToken.toString(),
                    isSignedIn
                }
                
                return user
            } else if (nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
                return {
                    username,
                    requireNewPassword: true,
                    nextStep: nextStep.signInStep
                }
            } else {
                throw new Error(`Authentication requires ${nextStep.signInStep}`)
            }
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
    error: null,
    requireNewPassword: false
}

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        loginSuccess: (state, action) => {
            state.isLoggedIn = true;
            state.user = action.payload;
            state.error = null;
            state.isLoading = false;
            state.requireNewPassword = false;
        },
        loginFailure: (state, action) => {
            state.isLoggedIn = false;
            state.user = null;
            state.error = action.payload;
            state.isLoading = false;
        },
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
        resetState: (state) => {
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
                if (action.payload.requireNewPassword) {
                    state.requireNewPassword = true;
                    state.user = { username: action.payload.username };
                } else {
                    state.user = action.payload;
                    state.isLoggedIn = true;
                    state.showLoginForm = false;
                    state.showSignupForm = false;
                }
                state.error = null
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.isLoading = false
                state.error = action.payload
            })
            .addCase(logoutUser.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(logoutUser.fulfilled, (state) => {
                Object.assign(state, initialState);
            })
            .addCase(logoutUser.rejected, (state, action) => {
                state.error = action.payload;
                state.isLoading = false;
            })
    }
})

export const { 
    showLogin, 
    showSignup, 
    resetState, 
    clearError,
    loginSuccess,
    loginFailure
} = userSlice.actions

export default userSlice.reducer