import json
import boto3
import os
from typing import Any
from lambda_utils import create_response, extract_user_from_token


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AWS Lambda function to generate S3 presigned URLs for file uploads.
    
    This function is designed to be invoked via API Gateway as a Lambda proxy.
    It expects the following in the request body:
    - bucket: S3 bucket name
    - key: S3 object key (file path)
    - contentType: MIME type of the file to be uploaded
    
    Returns:
    - presignedUrl: The S3 presigned URL for PUT operation
    """
    
    # Initialize S3 client
    s3_client = boto3.client('s3')
    
    # Default expiration time (in seconds) - can be overridden by environment variable
    expiration = int(os.environ.get('PRESIGNED_URL_EXPIRATION', '3600'))
    
    try:
        # Parse the request body
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        # Extract required parameters
        bucket = body.get('bucket')
        key = body.get('key')
        content_type = body.get('contentType')
        
        # Validate required parameters
        if not bucket:
            return create_response(400, {'error': 'Missing required parameter: bucket'})
        
        if not key:
            return create_response(400, {'error': 'Missing required parameter: key'})
        
        if not content_type:
            return create_response(400, {'error': 'Missing required parameter: contentType'})
        
        # Validate file type - only allow PDF files
        if content_type != 'application/pdf':
            return create_response(400, {'error': f'Invalid file type: {content_type}. Only PDF files (application/pdf) are allowed'})
        
        # Extract authorization header (always required)
        authorization = event.get('headers', {}).get('Authorization', '') or event.get('headers', {}).get('authorization', '')
        
        if not authorization:
            return create_response(401, {'error': 'Missing Authorization header'})
        
        # Check if authorization bypass is enabled (for testing purposes only)
        bypass_auth = os.environ.get('BYPASS_AUTH_CHECK', 'false').lower() in ('true', '1', 'yes')
        
        if bypass_auth:
            # Skip token validation and user_id checks - for testing only
            print("WARNING: Authorization validation bypassed (BYPASS_AUTH_CHECK is enabled)")
            user_id = None
        else:
            # Validate authorization token (required for multi-tenant security)
            user_id = extract_user_from_token(authorization)
            
            if not user_id:
                return create_response(401, {'error': 'Invalid or expired authorization token'})
            
            # Validate that the key path is prefixed with user_id for multi-tenant security
            if not key.startswith(f"{user_id}/"):
                return create_response(403, {'error': f'Access denied: Key must be prefixed with user ID ({user_id}/)'})
        
        # Log the request (useful for debugging)
        print(f"Generating presigned URL for user: {user_id or 'BYPASS'}, bucket: {bucket}, key: {key}")
        
        # Check if the key already exists in the bucket
        try:
            s3_client.head_object(Bucket=bucket, Key=key)
            # If head_object succeeds, the object exists
            return create_response(409, {'error': f'Object already exists at key: {key}'})
        except s3_client.exceptions.NoSuchKey:
            # Object doesn't exist, which is what we want
            pass
        except s3_client.exceptions.ClientError as e:
            # Check if it's a 404 error (object doesn't exist)
            if e.response['Error']['Code'] == '404':
                # Object doesn't exist, which is what we want
                pass
            else:
                # Some other error occurred
                raise
        
        # Generate presigned URL for PUT operation
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket,
                'Key': key,
                'ContentType': content_type,
            },
            ExpiresIn= expiration,
            HttpMethod='PUT'
        )
        
        # Return successful response
        return create_response(200, {
            'presignedUrl': presigned_url,
            'bucket': bucket,
            'key': key,
            'expiresIn': expiration
        })
        
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {str(e)}")
        return create_response(400, {'error': 'Invalid JSON in request body'})
    
    except boto3.exceptions.Boto3Error as e:
        print(f"AWS error: {str(e)}")
        return create_response(500, {'error': f'AWS service error: {str(e)}'})
    
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        return create_response(500, {'error': f'Internal server error: {str(e)}'})
