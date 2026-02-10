import { createSlice } from '@reduxjs/toolkit';
import { listS3Objects, getPresignedUrlForGet } from '../../utils/aws-api';
import { fetchAuthSession } from 'aws-amplify/auth';

const initialState = {
    reports: [],
    loading: false,
    error: null,
    bucket: null,
    parentFolder: 'reports',
    // Current selected report
    selectedReport: null,
    // Cache timestamp for reports list
    reportsFetchedAt: null,
    // Cache for report PDFs - { reportKey: { url, fetchedAt, fileName } }
    loadedPdfs: {},
    // Loading state for individual reports
    loadingPdf: null,
};

const reportsSlice = createSlice({
    name: 'reports',
    initialState,
    reducers: {
        fetchReportsStart: (state) => {
            state.loading = true;
            state.error = null;
        },
        fetchReportsSuccess: (state, action) => {
            state.loading = false;
            state.reports = action.payload.files;
            state.bucket = action.payload.bucket;
            state.reportsFetchedAt = Date.now();
        },
        fetchReportsFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        clearReports: (state) => {
            state.reports = [];
            state.reportsFetchedAt = null;
            state.error = null;
        },
        // Set the currently selected report
        setSelectedReport: (state, action) => {
            state.selectedReport = action.payload;
        },
        // PDF caching actions
        fetchReportPdfStart: (state, action) => {
            state.loadingPdf = action.payload;
        },
        fetchReportPdfSuccess: (state, action) => {
            const { reportKey, url, fileName } = action.payload;
            state.loadedPdfs[reportKey] = {
                url,
                fileName,
                fetchedAt: Date.now(),
            };
            state.loadingPdf = null;
        },
        fetchReportPdfFailure: (state) => {
            state.loadingPdf = null;
        },
        // Clear cache entries
        clearPdfCache: (state, action) => {
            if (action.payload) {
                delete state.loadedPdfs[action.payload];
            } else {
                state.loadedPdfs = {};
            }
        },
    },
});

export const {
    fetchReportsStart,
    fetchReportsSuccess,
    fetchReportsFailure,
    clearReports,
    setSelectedReport,
    fetchReportPdfStart,
    fetchReportPdfSuccess,
    fetchReportPdfFailure,
    clearPdfCache,
} = reportsSlice.actions;

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
 * Thunk action to fetch reports list from S3
 * @param {string} bucket - S3 bucket name
 * @param {boolean} forceRefresh - Force fetch even if cached
 */
export const fetchReports = (bucket, forceRefresh = false) => async (dispatch, getState) => {
    try {
        const { loading, reports, reportsFetchedAt } = getState().reports;

        // Get user ID from Amplify auth session
        const session = await fetchAuthSession();
        const sub = session.tokens?.idToken?.payload?.sub;
        
        if (!sub) {
            throw new Error('User ID not found in session');
        }
        
        // Don't fetch if already loading
        if (loading) {
            return;
        }
        
        // Check cache first - if we have reports and they're fresh, use them
        if (!forceRefresh && reports.length > 0 && isCacheValid(reportsFetchedAt)) {
            console.log('Using cached reports list');
            return;
        }

        // Construct S3 parent folder for reports
        const parentFolder = `users/${sub}/reports/`;
        
        console.log('Fetching reports list from API');
        dispatch(fetchReportsStart());
        
        // List files (not folders) in the reports directory
        const result = await listS3Objects(bucket, parentFolder, true);
        
        dispatch(fetchReportsSuccess({
            files: result.files,
            bucket: result.bucket,
        }));
    } catch (error) {
        console.error('Error fetching reports:', error);
        dispatch(fetchReportsFailure(error.message));
    }
};

/**
 * Thunk action to fetch report PDF with caching
 * @param {string} reportKey - S3 key of the report
 * @param {string} fileName - Display name of the file
 * @param {boolean} forceRefresh - Force fetch even if cached
 */
export const fetchReportPdf = (reportKey, fileName, forceRefresh = false) => async (dispatch, getState) => {
    try {
        const state = getState();
        const { loadedPdfs, loadingPdf, bucket } = state.reports;
        
        // Check if already loading this report
        if (loadingPdf === reportKey) {
            return;
        }
        
        // Check cache first
        const cached = loadedPdfs[reportKey];
        if (!forceRefresh && cached && isCacheValid(cached.fetchedAt)) {
            console.log(`Using cached PDF for report: ${fileName}`);
            return cached.url;
        }
        
        dispatch(fetchReportPdfStart(reportKey));
        
        // Get presigned URL for the PDF
        const url = await getPresignedUrlForGet(bucket, reportKey);
        
        dispatch(fetchReportPdfSuccess({ reportKey, url, fileName }));
        return url;
        
    } catch (error) {
        console.error(`Error fetching PDF for report ${fileName}:`, error);
        dispatch(fetchReportPdfFailure());
        throw error;
    }
};

export default reportsSlice.reducer;
