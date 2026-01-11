# Lambda Deployment Guide: S3 Presigned URL (GET/PUT)

## Overview

The `lambda_s3_presigned_url.py` Lambda function now handles **both GET and PUT operations** using an `operation` parameter. This eliminates the need for a separate GET Lambda function.

## Quick Update Steps (If Already Deployed)

If you already have `lambda_s3_presigned_url` deployed, simply update it with the new code:

```bash
cd etl2report

# Create deployment package
zip lambda_s3_presigned_url.zip lambda_s3_presigned_url.py lambda_utils.py

# Update existing function
aws lambda update-function-code \
  --function-name lambda_s3_presigned_url \
  --zip-file fileb://lambda_s3_presigned_url.zip
```

**That's it!** No new Lambda, no new API Gateway endpoint, no new environment variables needed.

## First Time Deploy Steps

## First Time Deploy Steps

### 1. Package the Lambda
```bash
cd etl2report

# Create deployment package
zip lambda_s3_presigned_url.zip lambda_s3_presigned_url.py lambda_utils.py
```

### 2. Deploy via AWS CLI (if you have AWS CLI configured)
```bash
# Create the Lambda function
aws lambda create-function \
  --function-name lambda_s3_presigned_url \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_LAMBDA_EXECUTION_ROLE \
  --handler lambda_s3_presigned_url.lambda_handler \
  --zip-file fileb://lambda_s3_presigned_url.zip \
  --environment Variables="{S3_TENANT_ROLE_ARN=YOUR_TENANT_ROLE_ARN,PRESIGNED_URL_EXPIRATION=3600}" \
  --timeout 30 \
  --memory-size 128
```

### 3. Or Deploy via AWS Console

1. Go to AWS Lambda Console
2. Click "Create function"
3. Choose "Author from scratch"
4. Function name: `lambda_s3_presigned_url`
5. Runtime: Python 3.11 (or your preferred version)
6. Execution role: Use existing role with S3 and STS permissions
7. Click "Create function"
8. Upload the zip file or copy-paste the code
9. Add environment variables:
   - `S3_TENANT_ROLE_ARN`: Your tenant role ARN
   - `PRESIGNED_URL_EXPIRATION`: 3600 (optional)
10. Set timeout to 30 seconds
11. Save and Deploy

### 4. Create API Gateway Integration

The same API Gateway endpoint handles both PUT and GET operations.

#### Option A: Add to Existing API
1. Go to API Gateway console
2. Open your existing API
3. Create new resource: `/s3-presigned-url`
4. Add POST method
5. Integration type: Lambda Function
6. Lambda Function: `lambda_s3_presigned_url`
7. Use Lambda Proxy integration: ✓ Checked
8. Add Cognito User Pool Authorizer
9. Deploy API to `prod` stage

#### Option B: Use AWS CLI
```bash
# Get your API ID
API_ID="your-api-id"
PARENT_ID="your-root-resource-id"
REGION="us-east-1"

# Create resource
aws apigateway create-resource \
  --rest-api-id $API_ID \
  --parent-id $PARENT_ID \
  --path-part s3-presigned-url

# Add POST method (get the resource ID from previous command)
RESOURCE_ID="new-resource-id"
aws apigateway put-method \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --authorization-type COGNITO_USER_POOLS \
  --authorizer-id YOUR_COGNITO_AUTHORIZER_ID

# Create Lambda integration
aws apigateway put-integration \
  --rest-api-id $API_ID \
  --resource-id $RESOURCE_ID \
  --http-method POST \
  --type AWS_PROXY \
  --integration-http-method POST \
  --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$REGION:YOUR_ACCOUNT_ID:function:lambda_s3_presigned_url/invocations"

# Deploy
aws apigateway create-deployment \
  --rest-api-id $API_ID \
  --stage-name prod
```

### 5. Add Lambda Permission for API Gateway
```bash
aws lambda add-permission \
  --function-name lambda_s3_presigned_url \
  --statement-id apigateway-invoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:REGION:ACCOUNT_ID:API_ID/*/POST/s3-presigned-url"
```

### 6. Environment Variable

Your `.env` file should already have:

```bash
# This endpoint now handles both GET and PUT operations
VITE_AWS_S3_PUT_API_ENDPOINT=https://YOUR_API_ID.execute-api.REGION.amazonaws.com/prod
```

**No additional environment variable needed!**

### 7. Test the Lambda

#### Test PUT Operation
```json
{
  "body": "{\"bucket\":\"etl2report-multi-tenant-bucket\",\"key\":\"USER_SUB/templates/test-template/test-template.pdf\",\"operation\":\"put\",\"contentType\":\"application/pdf\"}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "USER_SUB"
      }
    }
  }
}
```

#### Test GET Operation
```json
{
  "body": "{\"bucket\":\"etl2report-multi-tenant-bucket\",\"key\":\"USER_SUB/templates/test-template/test-template.pdf\",\"operation\":\"get\"}",
  "requestContext": {
    "authorizer": {
      "claims": {
        "sub": "USER_SUB"
      }
    }
  }/updated and deployed
- [ ] Environment variables set (S3_TENANT_ROLE_ARN)
- [ ] Lambda has permissions to assume tenant role
- [ ] API Gateway endpoint configured with POST method
- [ ] Cognito User Pool authorizer attached
- [ ] API Gateway has permission to invoke Lambda
- [ ] API deployed to `prod` stage
- [ ] Endpoint URL configured in `.env` as `VITE_AWS_S3_PUT_API_ENDPOINT`
- [ ] Both PUT and GET operations tested successfully\",\"bucket\":\"...\",\"key\":\"...\",\"operation\":\"put|get\",\"expiresIn\":3600}"
}
```

## Operation Parameter

The Lambda function now accepts an `operation` parameter in the request body:

- **`operation: 'put'`** (default if not specified)
  - Generates presigned URL for uploading
  - Requires `contentType` parameter
  - Checks that object doesn't already exist (409 if exists)
  - Only allows `application/pdf` content type

- **`operation: 'get'`**
  - Generates presigned URL for downloading/viewing
  - Does NOT require `contentType`
  - Checks that object exists (404 if not found)
  - No file type restrictions

## Verification Checklist

- [ ] Lambda function created and deployed
- [ ] Environment variables set (S3_TENANT_ROLE_ARN)
- [ ] Lambda has permissions to assume tenant role
- [ ] API Gateway endpoint created with POST method
- [ ] Cognito User Pool authorizer attached
- [ ] API Gateway has permission to invoke Lambda
- [ ] API deployed to `prod` stage
- [ ] Endpoint URL added to `.env` as `VITE_AWS_S3_GET_API_ENDPOINT`
- [ ] Dev server restarted (`npm run dev`)

## IAM Permissions Required

The Lambda execution role needs:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::ACCOUNT_ID:role/YOUR_TENANT_ROLE"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

The tenant role needs S3 GetObject permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::etl2report-multi-tenant-bucket/${aws:PrincipalTag/user_id}/*"
    }
  ]
}
```

## Troubleshooting

**Error: "Invalid operation"**
- Ensure `operation` parameter is either "get" or "put" (lowercase)

**Error: "Missing required parameter: contentType"**
- Content type is required for PUT operations
- Not required for GET operations

**Error: "S3_TENANT_ROLE_ARN not configured"**
- Check Lambda environment variables

**Error: "Access denied"**
- Verify key starts with correct user_id prefix
- Check tenant role permissions

**Error: "Object not found" (GET operation)**
- Verify the file exists in S3 at the specified key
- Check S3 key path format: `{sub}/templates/{templateName}/{templateName}.pdf`

**Error: "Object already exists" (PUT operation)**
- File already exists at that location
- Use a different key or delete the existing file first

**Error: "Failed to get presigned URL"**
- Check API Gateway logs
- Verify Cognito authorizer is working
- Check Lambda CloudWatch logs
- Verify `operation` parameter is being sent correctly
