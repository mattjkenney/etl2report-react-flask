import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    pdfUrl: null,           // Object URL for the PDF
    currentPage: 1,         // Current page being displayed
    totalPages: 0,          // Total number of pages in the PDF
    scale: 1.0,            // Zoom level
    isLoading: false,       // Loading state
    error: null            // Error message if any
}

const pdfViewerSlice = createSlice({
    name: 'pdfViewer',
    initialState,
    reducers: {
        setPdfUrl: (state, action) => {
            state.pdfUrl = action.payload
            if (!action.payload) {
                // Reset other state when clearing PDF
                state.currentPage = 1
                state.totalPages = 0
                state.error = null
            }
        },
        setCurrentPage: (state, action) => {
            state.currentPage = action.payload
        },
        setTotalPages: (state, action) => {
            state.totalPages = action.payload
        },
        setScale: (state, action) => {
            state.scale = action.payload
        },
        setLoading: (state, action) => {
            state.isLoading = action.payload
        },
        setError: (state, action) => {
            state.error = action.payload
        },
        resetPdfViewer: (state) => {
            Object.assign(state, initialState)
        }
    }
})

export const { 
    setPdfUrl,
    setCurrentPage,
    setTotalPages,
    setScale,
    setLoading,
    setError,
    resetPdfViewer
} = pdfViewerSlice.actions

export default pdfViewerSlice.reducer