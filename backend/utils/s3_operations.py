"""
S3 Operations Module

This module orchestrates S3-related operations by calling API Gateway Lambda functions.
It builds user-specific S3 paths and handles complex operations like file uploads and
template fetching.

Functions use JWT tokens to:
1. Extract user_id for path building (via jwt_helper)
2. Pass token to API Gateway for validation (via api_gateway_client)

S3 Path Structure:
    users/{user_id}/templates/     - HTML templates
    users/{user_id}/pdfs/          - PDF files
    users/{user_id}/reports/       - Generated reports
    users/{user_id}/templates/{template_id}/textract-jobs/  - Textract results
"""

import requests
import logging
from utils.jwt_helper import extract_user_id, get_user_path_prefix
from utils.api_gateway_client import (
    call_s3_presigned_url_lambda,
    call_s3_list_lambda,
    ApiGatewayClientError
)

logger = logging.getLogger(__name__)


class S3OperationError(Exception):
    """Custom exception for S3 operation errors"""
    pass


def upload_file_to_s3(bucket, key, file_data, content_type, auth_token, user_id=None, description=None):
    """
    Upload a file to S3 using presigned URL.
    
    This function:
    1. Extracts user_id from token (if not provided)
    2. Builds user-specific S3 key
    3. Gets presigned PUT URL from Lambda
    4. Uploads file to S3
    
    Args:
        bucket (str): S3 bucket name
        key (str): S3 object key (can include or exclude user prefix)
        file_data (bytes): File content to upload
        content_type (str): MIME type of the file
        auth_token (str): JWT token
        user_id (str, optional): User ID (extracted from token if not provided)
        description (str, optional): File description for logging
        
    Returns:
        dict: Upload result with success status and metadata
        
    Example:
        {
            "success": true,
            "message": "File uploaded successfully",
            "bucket": "my-bucket",
            "key": "users/user123/pdfs/file.pdf",
            "file_name": "file.pdf",
            "size": 12345
        }
    """
    try:
        # Extract user_id if not provided
        if not user_id:
            user_id = extract_user_id(auth_token)
        
        # Build full S3 key with user prefix if not already included
        if not key.startswith(f'users/{user_id}/'):
            key = f'users/{user_id}/{key}'
        
        logger.info(f"Uploading file to S3: {bucket}/{key}")
        
        # Get presigned PUT URL from Lambda
        presigned_response = call_s3_presigned_url_lambda(
            bucket=bucket,
            key=key,
            method='put',
            auth_token=auth_token,
            content_type=content_type
        )
        
        # Check for presignedUrl in response (camelCase from Lambda)
        presigned_url = presigned_response.get('presignedUrl')
        if not presigned_url:
            # Try snake_case as fallback
            presigned_url = presigned_response.get('presigned_url')
        
        if not presigned_url:
            logger.error(f"Presigned URL not found in response: {presigned_response}")
            raise S3OperationError("Presigned URL not found in response")
        
        # Upload file to S3 using presigned URL
        logger.info(f"Uploading {len(file_data)} bytes to S3")
        
        upload_response = requests.put(
            presigned_url,
            data=file_data,
            headers={'Content-Type': content_type},
            timeout=300  # 5 minutes for large files
        )
        
        if upload_response.status_code not in [200, 204]:
            raise S3OperationError(f"S3 upload failed with status {upload_response.status_code}")
        
        logger.info(f"File uploaded successfully: {bucket}/{key}")
        
        # Extract file name from key
        file_name = key.split('/')[-1]
        
        return {
            'success': True,
            'message': 'File uploaded successfully',
            'bucket': bucket,
            'key': key,
            'file_name': file_name,
            'size': len(file_data),
            'content_type': content_type,
            'description': description
        }
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error during upload: {str(e)}")
        raise S3OperationError(f"Failed to upload file: {str(e)}")
    except requests.exceptions.RequestException as e:
        logger.error(f"S3 upload request error: {str(e)}")
        raise S3OperationError(f"Failed to upload file to S3: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during upload: {str(e)}")
        raise S3OperationError(f"Upload failed: {str(e)}")


def list_s3_objects(bucket, prefix, list_files, auth_token, user_id=None):
    """
    List folders or files in S3 bucket.
    
    Args:
        bucket (str): S3 bucket name
        prefix (str): Folder prefix (can include or exclude user prefix)
        list_files (bool): True to list files, False to list folders
        auth_token (str): JWT token
        user_id (str, optional): User ID (extracted from token if not provided)
        
    Returns:
        dict: List of folders or files
        
    Example (list_files=False):
        {
            "success": true,
            "folders": ["templates/", "reports/", "pdfs/"]
        }
        
    Example (list_files=True):
        {
            "success": true,
            "files": [
                {
                    "file_name": "template1.html",
                    "key": "users/user123/templates/template1.html",
                    "size": 12345,
                    "last_modified": "2024-01-15T10:30:00Z"
                }
            ]
        }
    """
    try:
        # Extract user_id if not provided
        if not user_id:
            user_id = extract_user_id(auth_token)
        
        # Build full prefix with user path if not already included
        if not prefix.startswith(f'users/{user_id}/'):
            prefix = f'users/{user_id}/{prefix}' if prefix else f'users/{user_id}/'
        
        logger.info(f"Listing S3 objects: bucket={bucket}, prefix={prefix}, list_files={list_files}")
        
        # Call Lambda via API Gateway
        response = call_s3_list_lambda(
            bucket=bucket,
            parent_folder=prefix,
            list_files=list_files,
            auth_token=auth_token
        )
        
        # Lambda returns data directly (errors would have raised ApiGatewayClientError)
        return response
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error during list: {str(e)}")
        raise S3OperationError(f"Failed to list S3 objects: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error during list: {str(e)}")
        raise S3OperationError(f"List operation failed: {str(e)}")


def get_presigned_url(bucket, key, method, auth_token, user_id=None, content_type=None, expiration=3600):
    """
    Get presigned URL for S3 operations.
    
    Args:
        bucket (str): S3 bucket name
        key (str): S3 object key (can include or exclude user prefix)
        method (str): HTTP method ('get' or 'put')
        auth_token (str): JWT token
        user_id (str, optional): User ID (extracted from token if not provided)
        content_type (str, optional): Content type for PUT operations
        expiration (int, optional): URL expiration in seconds (default 3600)
        
    Returns:
        dict: Presigned URL and metadata
        
    Example:
        {
            "success": true,
            "presigned_url": "https://s3.amazonaws.com/...",
            "bucket": "my-bucket",
            "key": "users/user123/file.pdf",
            "method": "get",
            "expires_in": 3600
        }
    """
    try:
        # Extract user_id if not provided
        if not user_id:
            user_id = extract_user_id(auth_token)
        
        # Build full S3 key with user prefix if not already included
        if not key.startswith(f'users/{user_id}/'):
            key = f'users/{user_id}/{key}'
        
        logger.info(f"Getting presigned URL: {method.upper()} {bucket}/{key}")
        
        # Call Lambda via API Gateway
        response = call_s3_presigned_url_lambda(
            bucket=bucket,
            key=key,
            method=method,
            auth_token=auth_token,
            content_type=content_type,
            expiration=expiration
        )
        
        # Lambda returns camelCase, normalize to snake_case for consistency
        normalized_response = {
            'success': True,
            'presigned_url': response.get('presignedUrl'),
            'bucket': response.get('bucket'),
            'key': response.get('key'),
            'method': response.get('method'),
            'expires_in': response.get('expiresIn')
        }
        
        return normalized_response
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error getting presigned URL: {str(e)}")
        raise S3OperationError(f"Failed to get presigned URL: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting presigned URL: {str(e)}")
        raise S3OperationError(f"Presigned URL operation failed: {str(e)}")


def fetch_html_template(bucket, template_name, auth_token, user_id=None):
    """
    Fetch HTML template content from S3.
    
    This function:
    1. Builds the template S3 key with user prefix
    2. Gets presigned GET URL
    3. Fetches the HTML content
    
    Args:
        bucket (str): S3 bucket name
        template_name (str): Template file name (e.g., "template1.html")
        auth_token (str): JWT token
        user_id (str, optional): User ID (extracted from token if not provided)
        
    Returns:
        dict: Template content and metadata
        
    Example:
        {
            "success": true,
            "html_content": "<html>...</html>",
            "template_name": "template1.html",
            "size": 12345
        }
    """
    try:
        # Extract user_id if not provided
        if not user_id:
            user_id = extract_user_id(auth_token)
        
        # Build template key (assumes templates/ folder structure)
        if not template_name.startswith(f'users/{user_id}/'):
            template_key = f'users/{user_id}/templates/{template_name}'
        else:
            template_key = template_name
        
        logger.info(f"Fetching HTML template: {bucket}/{template_key}")
        
        # Get presigned GET URL
        presigned_response = call_s3_presigned_url_lambda(
            bucket=bucket,
            key=template_key,
            method='get',
            auth_token=auth_token
        )
        
        # Check for presignedUrl in response (camelCase from Lambda)
        presigned_url = presigned_response.get('presignedUrl')
        if not presigned_url:
            # Try snake_case as fallback
            presigned_url = presigned_response.get('presigned_url')
        
        if not presigned_url:
            logger.error(f"Presigned URL not found in response: {presigned_response}")
            raise S3OperationError("Presigned URL not found in response")
        
        # Fetch HTML content from S3
        logger.info(f"Downloading template from S3")
        
        download_response = requests.get(presigned_url, timeout=30)
        
        if download_response.status_code != 200:
            raise S3OperationError(f"Failed to download template: HTTP {download_response.status_code}")
        
        html_content = download_response.text
        
        logger.info(f"Template fetched successfully: {len(html_content)} characters")
        
        return {
            'success': True,
            'html_content': html_content,
            'template_name': template_name,
            'size': len(html_content)
        }
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error fetching template: {str(e)}")
        raise S3OperationError(f"Failed to fetch template: {str(e)}")
    except requests.exceptions.RequestException as e:
        logger.error(f"Template download error: {str(e)}")
        raise S3OperationError(f"Failed to download template: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching template: {str(e)}")
        raise S3OperationError(f"Template fetch failed: {str(e)}")
