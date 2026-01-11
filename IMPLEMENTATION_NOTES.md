# Template PDF & Textract Caching Implementation

## Summary

I've implemented a client-side caching system for template PDFs and Textract analysis results. This uses Redux state to cache data in browser memory with a 30-minute TTL, preventing unnecessary API calls while maintaining fresh data.

## What Was Implemented

### 1. Redux Store Updates ([templates.js](etl2report/src/store/dash/templates.js))
- Added `loadedPdfs` and `loadedTextract` cache objects to state
- Added caching actions: `fetchPdfStart/Success/Failure`, `fetchTextractStart/Success/Failure`
- Added cache clearing actions: `clearPdfCache`, `clearTextractCache`
- Implemented `fetchTemplatePdf()` thunk with cache-check and 30min TTL
- Implemented `fetchTemplateTextract()` thunk with cache-check and 30min TTL

### 2. API Integration ([aws-api.js](etl2report/src/utils/aws-api.js))
- Added `getPresignedUrlForGet()` function to fetch S3 GET presigned URLs
- Integrated with authentication and multi-tenant security

### 3. Component Updates ([Actions.jsx](etl2report/src/components/Actions.jsx))
- Updated `handleTemplateChange()` to automatically load PDF when template selected
- Updated Edit button to fetch and apply Textract results
- Integrated with Redux actions for loading state management

### 4. Backend Lambda ([lambda_s3_presigned_url.py](etl2report/lambda_s3_presigned_url.py))
- Updated to handle both PUT and GET operations via `operation` parameter
- Added validation for GET operations (checks if object exists)
- Added validation for PUT operations (checks if object doesn't exist)
- Unified endpoint reduces infrastructure complexity

## How It Works

1. **On Template Selection:**
   - Checks cache for PDF URL
   - If cached and < 30min old: Use cached URL (instant)
   - If not cached or expired: Fetch new presigned URL from S3
   - Store in cache with timestamp

2. **On Edit Button Click:**
   - Checks cache for Textract results
   - If cached and < 30min old: Use cached results (instant)
   - If not cached or expired: Fetch from S3
   - Store in cache with timestamp

3. **Cache Benefits:**
   - Fast template switching (instant after first load)
   - Minimal API calls (only when needed)
   - Automatic expiration ensures fresh data
   - All in-memory (no database needed)

## AWS Setup Required

The Lambda function has been updated to handle both GET and PUT operations. You just need to **redeploy the existing Lambda** with the updated code:

### 1. Redeploy Lambda Function

```bash
# The Lambda function is already updated at:
# etl2report/lambda_s3_presigned_url.py

# If you previously deployed it, just update the function code:
# - No new Lambda function needed
# - No new API Gateway endpoint needed
# - Uses the same VITE_AWS_S3_PUT_API_ENDPOINT for both operations
```

### 2. Update Lambda Code

Simply redeploy the updated `lambda_s3_presigned_url.py`:
- No environment variable changes needed
- Same execution role
- Same API Gateway endpoint

### 3. How It Works

The Lambda now accepts an `operation` parameter:
- `operation: 'put'` - Upload files (requires `contentType`)
- `operation: 'get'` - Download/view files (no `contentType` needed)

**No new environment variables needed!** The existing `VITE_AWS_S3_PUT_API_ENDPOINT` is used for both operations.

## Testing the Implementation

1. **Test Template Selection:**
   - Select a template from dropdown
   - PDF should load in View panel
   - Check browser console for "Using cached PDF" on subsequent selections

2. **Test Edit Button:**
   - Select a template
   - Click Edit button
   - Textract bounding boxes should appear
   - Check console for cache messages

3. **Test Cache Expiration:**
   - Wait 30 minutes (or temporarily change CACHE_TTL to 5000 for 5 seconds)
   - Select same template again
   - Should fetch fresh data

4. **Test Lambda Operations:**
   - Upload: Sends `operation: 'put'` with contentType
   - View/Download: Sends `operation: 'get'` without contentType

## Cache Configuration

To adjust cache behavior, edit [templates.js](etl2report/src/store/dash/templates.js):

```javascript
// Change cache TTL (currently 30 minutes)
const CACHE_TTL = 30 * 60 * 1000; // milliseconds
```

## API Call Optimization

Current behavior:
- **First template view:** 1 API call (presigned URL for PDF)
- **Edit button:** 1 API call (presigned URL for Textract JSON)
- **Switching back to viewed template:** 0 API calls (cached)
- **After 30 minutes:** Fresh fetch (1-2 API calls depending on what expired)

This provides an excellent balance between performance and data freshness!
