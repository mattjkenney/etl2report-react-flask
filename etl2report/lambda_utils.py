"""
Utility functions for AWS Lambda functions.

This module contains reusable helper functions for Lambda proxy integrations,
including JWT token extraction and standardized error response creation.
"""

import json
import base64
import os
import boto3
from datetime import datetime, timezone
from typing import Any

def create_response(status_code: int, body: dict[str, Any]) -> dict[str, Any]:
    """
    Create a standardized Lambda proxy response.
    
    Uses environment variables to configure CORS headers for flexibility across
    different Lambda functions:
    - CORS_ALLOW_ORIGIN: Access-Control-Allow-Origin (default: '*')
    - CORS_ALLOW_HEADERS: Access-Control-Allow-Headers (default: 'Content-Type,Authorization')
    - CORS_ALLOW_METHODS: Access-Control-Allow-Methods (default: 'POST,OPTIONS')
    
    Args:
        status_code: HTTP status code
        body: Response body dictionary (timestamp will be added automatically)
        
    Returns:
        Lambda proxy response dictionary
    """
    # Add timestamp to the body
    body['timestamp'] = datetime.now(timezone.utc).isoformat()
    
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': os.environ.get('CORS_ALLOW_ORIGIN', '*'),
            'Access-Control-Allow-Headers': os.environ.get('CORS_ALLOW_HEADERS', 'Content-Type,Authorization'),
            'Access-Control-Allow-Methods': os.environ.get('CORS_ALLOW_METHODS', 'POST,OPTIONS')
        },
        'body': json.dumps(body)
    }


def extract_user_from_token(authorization: str) -> str | None:
    """
    Extract user ID from the Authorization header.
    
    Decodes the JWT token from Cognito and extracts the 'sub' (user ID) claim.
    Note: This implementation does NOT verify the signature. For production use,
    you should verify the signature using python-jose or a similar library.
    
    Args:
        authorization: Authorization header value (e.g., "Bearer <token>")
        
    Returns:
        User ID (sub) from the token, or None if extraction fails
    """
    try:
        # Remove "Bearer " prefix if present
        token = authorization.replace('Bearer ', '').strip()
        
        if not token:
            return None
        
        # Split the JWT token (header.payload.signature)
        parts = token.split('.')
        if len(parts) != 3:
            print("Invalid JWT format: expected 3 parts")
            return None
        
        # Decode the payload (second part)
        # Add padding if necessary (JWT base64 encoding may not include padding)
        payload = parts[1]
        padding = 4 - (len(payload) % 4)
        if padding != 4:
            payload += '=' * padding
        
        # Decode base64
        decoded_bytes = base64.urlsafe_b64decode(payload)
        decoded_json = json.loads(decoded_bytes)
        
        # Extract the 'sub' claim (user ID)
        user_id = decoded_json.get('sub')
        
        if not user_id:
            print("No 'sub' claim found in token")
            return None
        
        print(f"Extracted user_id: {user_id}")
        return user_id
        
    except json.JSONDecodeError as e:
        print(f"Error decoding JWT payload: {str(e)}")
        return None
    except Exception as e:
        print(f"Error extracting user from token: {str(e)}")
        return None


def get_client_with_assumed_role(
    service_name: str,
    role_arn: str,
    tenant_id: str,
    role_session_name: str | None = None
) -> Any:
    """
    Create a boto3 client with credentials from an assumed IAM role.
    
    This function assumes an IAM role and tags the session with a tenant ID,
    enabling multi-tenant resource isolation through IAM policies and session tags.
    
    Args:
        service_name: AWS service name (e.g., 's3', 'textract', 'dynamodb')
        role_arn: ARN of the IAM role to assume (e.g., 'arn:aws:iam::123456789012:role/S3TenantRole')
        tenant_id: Tenant identifier to tag the session with
        role_session_name: Name for the role session (default: generated from tenant_id)
        
    Returns:
        boto3 client for the specified service with assumed role credentials
        
    Raises:
        Exception: If role assumption fails or credentials are invalid
        
    Example:
        >>> s3_client = get_client_with_assumed_role('s3', 'arn:aws:iam::123456789012:role/S3TenantRole', 'user-123')
        >>> s3_client.list_buckets()
    """
    # Initialize STS client
    sts = boto3.client('sts')
    
    # Generate session name from tenant_id if not provided
    if not role_session_name:
        role_session_name = tenant_id
    
    # Log the role assumption attempt for debugging
    print(f"Attempting to assume role: {role_arn} with session name: {role_session_name} and TenantID tag: {tenant_id}")
    
    # Assume the role and tag the session with the tenant_id
    assumed_role = sts.assume_role(
        RoleArn=role_arn,
        RoleSessionName=role_session_name,
        Tags=[{'Key': 'TenantID', 'Value': tenant_id}]
    )
    
    # Extract temporary credentials
    creds = assumed_role['Credentials']
    
    # Create and return a client with the temporary credentials
    client = boto3.client(
        service_name,
        aws_access_key_id=creds['AccessKeyId'],
        aws_secret_access_key=creds['SecretAccessKey'],
        aws_session_token=creds['SessionToken']
    )
    
    print(f"Created {service_name} client with assumed role for tenant: {tenant_id}")
    return client
