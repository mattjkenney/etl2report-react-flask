# Summary: Unified Lambda for GET/PUT Operations

## Changes Made

### ✅ Consolidated Lambda Function
Instead of creating a separate Lambda for GET operations, I've updated the existing [lambda_s3_presigned_url.py](etl2report/lambda_s3_presigned_url.py) to handle **both GET and PUT** operations using an `operation` parameter.

### Key Benefits
1. **Simpler infrastructure** - Only one Lambda function needed
2. **Single API endpoint** - Reuses existing `VITE_AWS_S3_PUT_API_ENDPOINT`
3. **No new environment variables** - Everything works with your current setup
4. **Easier maintenance** - One function to update instead of two

## What Changed

### 1. Lambda Function ([lambda_s3_presigned_url.py](etl2report/lambda_s3_presigned_url.py))
```python
# Now accepts 'operation' parameter
body = {
    "bucket": "...",
    "key": "...",
    "operation": "get" | "put",  # NEW!
    "contentType": "...",  # Only required for PUT
    "description": "..."   # Optional for PUT
}
```

**PUT Operation (`operation: 'put'`)**
- Requires `contentType` parameter
- Only allows PDF files
- Checks that file doesn't already exist (409 if exists)
- Generates presigned URL for uploading

**GET Operation (`operation: 'get'`)**
- No `contentType` required
- Checks that file exists (404 if not found)
- Generates presigned URL for downloading/viewing

### 2. Frontend API ([aws-api.js](etl2report/src/utils/aws-api.js))
- `uploadFile()` - Now sends `operation: 'put'`
- `getPresignedUrlForGet()` - Sends `operation: 'get'` to same endpoint

### 3. Deleted Files
- ❌ `lambda_s3_get_presigned_url.py` - No longer needed

## Deployment

If you've already deployed `lambda_s3_presigned_url`:

```bash
# Just update the existing Lambda with new code
cd etl2report
zip lambda_s3_presigned_url.zip lambda_s3_presigned_url.py lambda_utils.py
aws lambda update-function-code \
  --function-name lambda_s3_presigned_url \
  --zip-file fileb://lambda_s3_presigned_url.zip
```

**That's all!** No new Lambda, no new API Gateway, no new environment variables.

## Testing

### Upload (PUT)
```javascript
{
  "bucket": "etl2report-multi-tenant-bucket",
  "key": "user123/templates/my-template/my-template.pdf",
  "operation": "put",
  "contentType": "application/pdf"
}
```

### Download (GET)
```javascript
{
  "bucket": "etl2report-multi-tenant-bucket",
  "key": "user123/templates/my-template/my-template.pdf",
  "operation": "get"
}
```

## Implementation Status

✅ Lambda function updated  
✅ Frontend API updated  
✅ Actions component integrated  
✅ Templates Redux slice with caching  
✅ Documentation updated  
⏳ **Next:** Deploy updated Lambda function

See [LAMBDA_DEPLOYMENT.md](LAMBDA_DEPLOYMENT.md) for detailed deployment instructions.
