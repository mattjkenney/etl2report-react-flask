import { configureStore } from '@reduxjs/toolkit'
import authReducer from './auth/index.js'
import sizingReducer from './dash/sizing.js'
import newTemplateReducer from './dash/actions/newTemplate.js'
import pdfViewerReducer from './dash/pdfViewer.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sizing: sizingReducer,
    newTemplate: newTemplateReducer,
    pdfViewer: pdfViewerReducer,
  },
})

export default store