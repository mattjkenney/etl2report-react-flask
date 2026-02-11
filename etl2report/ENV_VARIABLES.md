# Frontend Environment Variables Reference

## Required Variables

### `VITE_FLASK_BACKEND_URL`
**Required:** Yes  
**Description:** URL of the Flask backend server  
**Example:** `http://localhost:5000`  
**Usage:** All AWS operations are now routed through this backend endpoint

### `VITE_AWS_S3_BUCKET`
**Required:** Yes  
**Description:** Default S3 bucket name for file operations  
**Example:** `my-etl2report-bucket`  
**Usage:** Used by frontend components to specify which bucket to use for operations

## Deprecated Variables (Phase 2 Refactoring)

The following variables are **no longer used** after Phase 2 refactoring.  
All Lambda/API Gateway endpoints are now configured in the backend only:

### ❌ `VITE_AWS_S3_GET_API_ENDPOINT`
**Status:** Deprecated  
**Replaced by:** Backend endpoint `/api/s3/presigned-url`

### ❌ `VITE_AWS_S3_PUT_API_ENDPOINT`
**Status:** Deprecated  
**Replaced by:** Backend endpoint `/api/s3/upload`

### ❌ `VITE_AWS_S3_LIST_FOLDERS_API_ENDPOINT`
**Status:** Deprecated  
**Replaced by:** Backend endpoint `/api/s3/list-objects`

### ❌ `VITE_AWS_TEXTRACT_START_DOCUMENT_ANALYSIS_API_ENDPOINT`
**Status:** Deprecated  
**Replaced by:** Backend endpoint `/api/textract/start-analysis`

### ❌ `VITE_AWS_TEXTRACT_GET_DOCUMENT_ANALYSIS_API_ENDPOINT`
**Status:** Deprecated  
**Replaced by:** Backend endpoint `/api/textract/get-results`

## Migration Steps

If you have existing `.env` files with the deprecated variables:

1. Keep `VITE_FLASK_BACKEND_URL` (required)
2. Keep `VITE_AWS_S3_BUCKET` (required)
3. Remove all API Gateway endpoint variables (they're now in backend config)

## Example `.env` File

```bash
# Flask Backend
VITE_FLASK_BACKEND_URL=http://localhost:5000

# S3 Configuration
VITE_AWS_S3_BUCKET=my-etl2report-bucket
```

## Notes

- All AWS API calls now go through the Flask backend
- Backend handles JWT token extraction and user path isolation
- Lambda functions remain unchanged (backend proxies to them)
- See [PHASE2_COMPLETION.md](../PHASE2_COMPLETION.md) for full details on Phase 2 changes
