import { configureStore } from '@reduxjs/toolkit'
import authReducer from './auth/index.js'
import sizingReducer from './dash/sizing.js'
import newTemplateReducer from './dash/actions/newTemplate.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sizing: sizingReducer,
    newTemplate: newTemplateReducer,
  },
})

export default store