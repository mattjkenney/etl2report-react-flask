import json
import boto3
import os
from typing import Any
from lambda_utils import create_response, get_client_with_assumed_role


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
    
    # Get role ARN from environment variable
    role_arn = os.environ.get('S3_TENANT_ROLE_ARN')
    
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
        description = body.get('description', '')
        
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
        
        # Extract user ID from Cognito authorizer claims
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        user_id = claims.get('sub')
        
        if not user_id:
            return create_response(401, {'error': 'Invalid or missing user ID from authorization'})
        
        # Validate that the key path is prefixed with user_id for multi-tenant security
        if not key.startswith(f"{user_id}/"):
            return create_response(403, {'error': f'Access denied: Key must be prefixed with user ID ({user_id}/)'})
        
        # Validate that role ARN is configured
        if not role_arn:
            return create_response(500, {'error': 'Server configuration error: S3_TENANT_ROLE_ARN not configured'})
        
        # Create S3 client with assumed role for multi-tenant isolation
        s3_client = get_client_with_assumed_role('s3', role_arn, user_id)
        
        # Log the request (useful for debugging)
        print(f"Generating presigned URL for user: {user_id}, bucket: {bucket}, key: {key}")
        
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
        params = {
            'Bucket': bucket,
            'Key': key,
            'ContentType': content_type,
        }
        
        # Add metadata if description is provided
        if description:
            params['Metadata'] = {'description': description}
        
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params=params,
            ExpiresIn=expiration,
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
