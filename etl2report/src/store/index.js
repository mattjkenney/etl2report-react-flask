import { configureStore } from '@reduxjs/toolkit'
import authReducer from './auth/index.js'
import sizingReducer from './dash/sizing.js'
import newTemplateReducer from './dash/actions/newTemplate.js'
import pdfViewerReducer from './dash/pdfViewer.js'
import messagesReducer from './messages.js'
import templatesReducer from './dash/templates.js'
import viewReducer from './dash/view.js'
import variablesReducer from './dash/variables.js'
import variableContainersReducer from './dash/variableContainers.js'
import boxBindingsReducer from './dash/boxBindings.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    sizing: sizingReducer,
    newTemplate: newTemplateReducer,
    pdfViewer: pdfViewerReducer,
    messages: messagesReducer,
    templates: templatesReducer,
    view: viewReducer,
    variables: variablesReducer,
    variableContainers: variableContainersReducer,
    boxBindings: boxBindingsReducer,
  },
})

export default store