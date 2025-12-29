import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    messages: []
}

const messagesSlice = createSlice({
    name: 'messages',
    initialState,
    reducers: {
        addMessage: (state, action) => {
            // action.payload should be { id, message, isError }
            state.messages.push(action.payload)
        },
        removeMessage: (state, action) => {
            // action.payload is the message id
            state.messages = state.messages.filter(msg => msg.id !== action.payload)
        },
        clearMessages: (state) => {
            state.messages = []
        }
    }
})

export const { addMessage, removeMessage, clearMessages } = messagesSlice.actions

export default messagesSlice.reducer
