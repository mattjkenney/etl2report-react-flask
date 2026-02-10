"""
Utility functions for AWS Lambda functions.

This module contains reusable helper functions for Lambda proxy integrations,
including standardized error response creation and IAM role assumption for multi-tenant isolation.

Note: JWT token extraction is not needed here since API Gateway Cognito Authorizer
provides the user_id (sub) directly via event['requestContext']['authorizer']['claims']['sub'].
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
