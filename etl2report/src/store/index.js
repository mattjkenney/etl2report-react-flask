import { configureStore } from '@reduxjs/toolkit'
import authReducer from './auth/index.js'

export const store = configureStore({
  reducer: {
    auth: authReducer
  }
})

export default store