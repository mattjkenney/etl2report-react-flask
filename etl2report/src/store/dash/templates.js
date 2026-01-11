import { createSlice } from '@reduxjs/toolkit';
import { listS3Folders } from '../../utils/aws-api';

const initialState = {
    templates: [],
    loading: false,
    error: null,
    bucket: null,
    parentFolder: 'templates',
};

const templatesSlice = createSlice({
    name: 'templates',
    initialState,
    reducers: {
        fetchTemplatesStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        fetchTemplatesSuccess: (state, action) => {
            state.loading = false;
            state.templates = action.payload.folders;
            state.bucket = action.payload.bucket;
        },
        fetchTemplatesFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        clearTemplates: (state) => {
            state.templates = [];
            state.error = null;
        },
    },
});

export const {
    fetchTemplatesStart,
    fetchTemplatesSuccess,
    fetchTemplatesFailure,
    clearTemplates,
} = templatesSlice.actions;

// Thunk action to fetch templates from S3
export const fetchTemplates = (bucket, parentFolder = 'templates') => async (dispatch) => {
    try {
        dispatch(fetchTemplatesStart());
        const result = await listS3Folders(bucket, parentFolder);
        dispatch(fetchTemplatesSuccess({
            folders: result.folders,
            bucket: result.bucket,
        }));
    } catch (error) {
        dispatch(fetchTemplatesFailure(error.message));
    }
};

export default templatesSlice.reducer;
