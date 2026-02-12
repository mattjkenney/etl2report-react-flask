# Lambda Layer Setup Guide

## Problem
Lambda functions are failing with:
```
Unable to import module 'lambda_function': No module named 'lambda_utils'
```

This happens because the Lambda layer wasn't structured correctly.

## Solution

### 1. Create the Lambda Layer with Correct Structure

AWS Lambda requires Python layers to have a specific directory structure:

```
lambda-utils-layer.zip
└── python/
    └── lambda_utils.py
```

The `python/` directory is **required** - AWS automatically adds `/opt/python` to the Python path when the layer is deployed.

### 2. Build the Layer

Run the provided script from the `lambda_proxies` directory:

```bash
cd backend/lambda_proxies
./create-layer.sh
```

This creates `lambda-utils-layer.zip` with the correct structure.

### 3. Deploy the Layer to AWS

```bash
aws lambda publish-layer-version \
  --layer-name lambda-utils \
  --description "Shared utilities for Lambda functions" \
  --zip-file fileb://lambda-utils-layer.zip \
  --compatible-runtimes python3.11 python3.12 \
  --region us-east-1
```

Note the Layer ARN from the output - you'll need it in the next step.

### 4. Attach Layer to Lambda Functions

For each Lambda function that uses `lambda_utils`, attach the layer:

```bash
# Get the layer version ARN from step 3
LAYER_ARN="arn:aws:lambda:us-east-1:ACCOUNT_ID:layer:lambda-utils:1"

# Attach to each function
aws lambda update-function-configuration \
  --function-name lambda-s3-presigned-url \
  --layers $LAYER_ARN

aws lambda update-function-configuration \
  --function-name lambda-list-s3-folders \
  --layers $LAYER_ARN

aws lambda update-function-configuration \
  --function-name lambda-start-textract-analysis \
  --layers $LAYER_ARN

aws lambda update-function-configuration \
  --function-name lambda-get-textract-results \
  --layers $LAYER_ARN
```

### 5. Verify the Import Works

The Lambda functions can now use:
```python
from lambda_utils import create_response, get_client_with_assumed_role
```

This import works because:
- Layer is extracted to `/opt/python/lambda_utils.py`
- `/opt/python` is automatically in Python's import path
- Therefore `from lambda_utils import ...` finds the module

## Alternative: Deploy as Package

If you prefer to organize as a package:

```
lambda-utils-layer.zip
└── python/
    └── lib/
        └── lambda_utils.py
```

Then change imports to:
```python
from lib.lambda_utils import create_response, get_client_with_assumed_role
```

## Troubleshooting

### Layer not found
- Ensure the layer was deployed to the same region as your Lambda functions
- Verify the layer ARN is correct

### Still getting import errors
- Check CloudWatch logs for the exact error
- Verify layer is attached: `aws lambda get-function-configuration --function-name FUNCTION_NAME`
- Ensure the zip structure is correct: `unzip -l lambda-utils-layer.zip`

### Permissions issues
- Ensure your IAM user/role has `lambda:PublishLayerVersion` permission
- Ensure Lambda functions have `lambda:GetLayerVersion` permission

## Layer Updates

When you update `lambda_utils.py`:

1. Run `./create-layer.sh` again
2. Publish a new layer version (AWS keeps old versions)
3. Update Lambda functions to use the new version

```bash
# Publish new version
aws lambda publish-layer-version \
  --layer-name lambda-utils \
  --zip-file fileb://lambda-utils-layer.zip \
  --compatible-runtimes python3.11 python3.12

# Get the new version ARN and update functions
LAYER_ARN="arn:aws:lambda:us-east-1:ACCOUNT_ID:layer:lambda-utils:2"
aws lambda update-function-configuration \
  --function-name FUNCTION_NAME \
  --layers $LAYER_ARN
```
