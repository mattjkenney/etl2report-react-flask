import json
import boto3
import os
from typing import Any
from lambda_utils import create_response, get_client_with_assumed_role


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AWS Lambda function to generate S3 presigned URLs for file operations (GET/PUT).
    
    This function is designed to be invoked via API Gateway as a Lambda proxy.
    It expects the following in the request body:
    - bucket: S3 bucket name
    - key: S3 object key (file path)
    - method: 'get' or 'put' (default: 'put')
    - contentType: MIME type (required for PUT operations only)
    - description: Optional metadata for PUT operations
    
    Returns:
    - presignedUrl: The S3 presigned URL for the requested operation
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
        method = body.get('method', 'put').lower()
        content_type = body.get('contentType')
        description = body.get('description', '')
        
        # Validate required parameters
        if not bucket:
            return create_response(400, {'error': 'Missing required parameter: bucket'})
        
        if not key:
            return create_response(400, {'error': 'Missing required parameter: key'})
        
        # Validate method
        if method not in ['get', 'put']:
            return create_response(400, {'error': f'Invalid method: {method}. Must be "get" or "put"'})
        
        # Validate content type for PUT operations
        if method == 'put':
            if not content_type:
                return create_response(400, {'error': 'Missing required parameter: contentType (required for PUT operations)'})
            
            # Validate file type - only allow PDF files for PUT
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
        print(f"Generating {method.upper()} presigned URL for user: {user_id}, bucket: {bucket}, key: {key}")
        
        # Check object existence based on method
        try:
            s3_client.head_object(Bucket=bucket, Key=key)
            # Object exists
            if method == 'put':
                # For PUT, object shouldn't exist
                return create_response(409, {'error': f'Object already exists at key: {key}'})
            # For GET, object exists - this is good, continue
        except s3_client.exceptions.NoSuchKey:
            # Object doesn't exist
            if method == 'get':
                # For GET, object should exist
                return create_response(404, {'error': f'Object not found at key: {key}'})
            # For PUT, object doesn't exist - this is good, continue
        except s3_client.exceptions.ClientError as e:
            # Check if it's a 404 error (object doesn't exist)
            if e.response['Error']['Code'] == '404':
                if method == 'get':
                    return create_response(404, {'error': f'Object not found at key: {key}'})
                # For PUT, continue
            else:
                # Some other error occurred
                raise
        
        # Generate presigned URL based on method
        if method == 'put':
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
        else:  # method == 'get'
            presigned_url = s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': bucket,
                    'Key': key,
                },
                ExpiresIn=expiration,
                HttpMethod='GET'
            )
        
        # Return successful response
        return create_response(200, {
            'presignedUrl': presigned_url,
            'bucket': bucket,
            'key': key,
            'method': method,
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
