import { configureStore } from '@reduxjs/toolkit'
import authReducer from './auth/index.js'
import sizingReducer from './dash/sizing.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sizing: sizingReducer
  }
})

export default store