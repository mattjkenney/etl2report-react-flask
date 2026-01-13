import { createSlice } from '@reduxjs/toolkit';
import { listS3Objects, getPresignedUrlForGet, getTextractResultsFromS3 } from '../../utils/aws-api';
import { fetchAuthSession } from 'aws-amplify/auth';

const initialState = {
    templates: [],
    loading: false,
    error: null,
    bucket: null,
    parentFolder: 'templates',
    // Cache timestamp for templates list
    templatesFetchedAt: null,
    // Cache for template PDFs - { templateName: { url, fetchedAt } }
    loadedPdfs: {},
    // Cache for template Textract results - { templateName: { blocks, fetchedAt } }
    loadedTextract: {},
    // Loading states for individual templates
    loadingPdf: null,
    loadingTextract: null,
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
            state.templatesFetchedAt = Date.now();
        },
        fetchTemplatesFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        clearTemplates: (state) => {
            state.templates = [];
            state.templatesFetchedAt = null;
            state.error = null;
        },
        // PDF caching actions
        fetchPdfStart: (state, action) => {
            state.loadingPdf = action.payload;
        },
        fetchPdfSuccess: (state, action) => {
            const { templateName, url } = action.payload;
            state.loadedPdfs[templateName] = {
                url,
                fetchedAt: Date.now(),
            };
            state.loadingPdf = null;
        },
        fetchPdfFailure: (state) => {
            state.loadingPdf = null;
        },
        // Textract caching actions
        fetchTextractStart: (state, action) => {
            state.loadingTextract = action.payload;
        },
        fetchTextractSuccess: (state, action) => {
            const { templateName, blocks } = action.payload;
            state.loadedTextract[templateName] = {
                blocks,
                fetchedAt: Date.now(),
            };
            state.loadingTextract = null;
        },
        fetchTextractFailure: (state) => {
            state.loadingTextract = null;
        },
        // Clear cache entries
        clearPdfCache: (state, action) => {
            if (action.payload) {
                delete state.loadedPdfs[action.payload];
            } else {
                state.loadedPdfs = {};
            }
        },
        clearTextractCache: (state, action) => {
            if (action.payload) {
                delete state.loadedTextract[action.payload];
            } else {
                state.loadedTextract = {};
            }
        },
        // Add a new template to the list
        addTemplate: (state, action) => {
            const templateName = action.payload;
            // Only add if it doesn't already exist
            if (!state.templates.includes(templateName)) {
                state.templates.push(templateName);
                // Keep the list sorted
                state.templates.sort();
            }
        },
    },
});

export const {
    fetchTemplatesStart,
    fetchTemplatesSuccess,
    fetchTemplatesFailure,
    clearTemplates,
    fetchPdfStart,
    fetchPdfSuccess,
    fetchPdfFailure,
    fetchTextractStart,
    fetchTextractSuccess,
    fetchTextractFailure,
    clearPdfCache,
    clearTextractCache,
    addTemplate,
} = templatesSlice.actions;

// Thunk action to fetch templates from S3
export const fetchTemplates = (bucket, parentFolder = 'templates', forceRefresh = false) => async (dispatch, getState) => {
    try {
        const { loading, templates, templatesFetchedAt } = getState().templates;
        
        // Don't fetch if already loading
        if (loading) {
            return;
        }
        
        // Check cache first - if we have templates and they're fresh, use them
        if (!forceRefresh && templates.length > 0 && isCacheValid(templatesFetchedAt)) {
            console.log('Using cached templates list');
            return;
        }
        
        console.log('Fetching templates list from API');
        dispatch(fetchTemplatesStart());
        const result = await listS3Objects(bucket, parentFolder);
        dispatch(fetchTemplatesSuccess({
            folders: result.folders,
            bucket: result.bucket,
        }));
    } catch (error) {
        dispatch(fetchTemplatesFailure(error.message));
    }
};

// Cache TTL in milliseconds (30 minutes)
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Check if cached data is still valid
 */
const isCacheValid = (fetchedAt) => {
    if (!fetchedAt) return false;
    return Date.now() - fetchedAt < CACHE_TTL;
};

/**
 * Thunk action to fetch template PDF with caching
 * @param {string} templateName - Name of the template
 * @param {boolean} forceRefresh - Force fetch even if cached
 */
export const fetchTemplatePdf = (templateName, forceRefresh = false) => async (dispatch, getState) => {
    try {
        const state = getState();
        const { loadedPdfs, loadingPdf, bucket } = state.templates;
        
        // Get user ID from Amplify auth session
        const session = await fetchAuthSession();
        const sub = session.tokens?.idToken?.payload?.sub;
        
        if (!sub) {
            throw new Error('User ID not found in session');
        }
        
        // Check if already loading this template
        if (loadingPdf === templateName) {
            return;
        }
        
        // Check cache first
        const cached = loadedPdfs[templateName];
        if (!forceRefresh && cached && isCacheValid(cached.fetchedAt)) {
            console.log(`Using cached PDF for template: ${templateName}`);
            return cached.url;
        }
        
        dispatch(fetchPdfStart(templateName));
        
        // Construct S3 key for the template PDF
        const s3Key = `${sub}/templates/${templateName}/${templateName}.pdf`;
        
        // Get presigned URL for the PDF
        const url = await getPresignedUrlForGet(bucket, s3Key);
        
        dispatch(fetchPdfSuccess({ templateName, url }));
        return url;
        
    } catch (error) {
        console.error(`Error fetching PDF for template ${templateName}:`, error);
        dispatch(fetchPdfFailure());
        throw error;
    }
};

/**
 * Thunk action to fetch template Textract results with caching
 * @param {string} templateName - Name of the template
 * @param {string} subsequentCall - The result file identifier (default: '1')
 * @param {boolean} forceRefresh - Force fetch even if cached
 */
export const fetchTemplateTextract = (templateName, subsequentCall = '1', forceRefresh = false) => async (dispatch, getState) => {
    try {
        const state = getState();
        const { loadedTextract, loadingTextract, bucket } = state.templates;
        
        // Get user ID from Amplify auth session
        const session = await fetchAuthSession();
        const sub = session.tokens?.idToken?.payload?.sub;
        
        if (!sub) {
            throw new Error('User ID not found in session');
        }
        
        // Check if already loading this template
        if (loadingTextract === templateName) {
            return;
        }
        
        // Check cache first
        const cached = loadedTextract[templateName];
        if (!forceRefresh && cached && isCacheValid(cached.fetchedAt)) {
            console.log(`Using cached Textract results for template: ${templateName}`);
            return cached.blocks;
        }
        
        dispatch(fetchTextractStart(templateName));
        
        // Use the new API that returns presigned URL for the Textract results
        const result = await getTextractResultsFromS3(bucket, templateName, subsequentCall);
        
        dispatch(fetchTextractSuccess({ templateName, blocks: result.blocks }));
        return result.blocks;
        
    } catch (error) {
        console.error(`Error fetching Textract results for template ${templateName}:`, error);
        dispatch(fetchTextractFailure());
        throw error;
    }
};

export default templatesSlice.reducer;
