"""
API Gateway Client Module

This module provides HTTP client functions for calling AWS API Gateway endpoints
that proxy to Lambda functions. The Flask backend uses these functions to
forward requests to the existing Lambda infrastructure.

Architecture:
    Frontend -> Flask Backend -> (this module) -> API Gateway -> Lambda -> AWS Services

Authentication:
    - Receives JWT token from Flask routes
    - Passes token in Authorization header to API Gateway
    - API Gateway Cognito Authorizer validates token
    - Lambda receives validated user info from authorizer context
"""

import requests
import logging
import os
import json

logger = logging.getLogger(__name__)


class ApiGatewayClientError(Exception):
    """Custom exception for API Gateway client errors"""
    pass


def _make_api_request(endpoint, method, data, auth_token, timeout=30):
    """
    Make an HTTP request to an API Gateway endpoint.
    
    Args:
        endpoint (str): The full API Gateway endpoint URL
        method (str): HTTP method (GET, POST, etc.)
        data (dict): Request body data
        auth_token (str): JWT token for Authorization header
        timeout (int): Request timeout in seconds
        
    Returns:
        dict: Response JSON data
        
    Raises:
        ApiGatewayClientError: If request fails or returns error
    """
    if not endpoint:
        raise ApiGatewayClientError("API Gateway endpoint not configured")
    
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        logger.info(f"Calling API Gateway: {method} {endpoint}")
        
        response = requests.request(
            method=method,
            url=endpoint,
            json=data,
            headers=headers,
            timeout=timeout
        )
        
        # Log response status
        logger.info(f"API Gateway response: {response.status_code}")
        
        # Try to parse JSON response
        try:
            response_data = response.json()
            logger.debug(f"API Gateway response data: {response_data}")
            
            # Handle Lambda proxy response format (if API Gateway returns the full Lambda response)
            # Lambda proxy returns: {"statusCode": 200, "body": "{...}", "headers": {...}}
            if isinstance(response_data, dict) and 'body' in response_data and 'statusCode' in response_data:
                logger.debug("Detected Lambda proxy response format, unwrapping body")
                # Parse the body string
                if isinstance(response_data['body'], str):
                    response_data = json.loads(response_data['body'])
                else:
                    response_data = response_data['body']
                logger.debug(f"Unwrapped response data: {response_data}")
                
        except ValueError:
            response_data = {'error': 'Invalid JSON response', 'text': response.text}
        
        # Check for HTTP errors
        if response.status_code >= 400:
            error_msg = response_data.get('error') or response_data.get('message') or f"HTTP {response.status_code}"
            logger.error(f"API Gateway error: {error_msg}")
            raise ApiGatewayClientError(f"API Gateway request failed: {error_msg}")
        
        return response_data
        
    except requests.exceptions.Timeout:
        logger.error(f"API Gateway request timeout: {endpoint}")
        raise ApiGatewayClientError("API Gateway request timeout")
    except requests.exceptions.ConnectionError as e:
        logger.error(f"API Gateway connection error: {str(e)}")
        raise ApiGatewayClientError(f"Failed to connect to API Gateway: {str(e)}")
    except requests.exceptions.RequestException as e:
        logger.error(f"API Gateway request error: {str(e)}")
        raise ApiGatewayClientError(f"API Gateway request failed: {str(e)}")


def call_s3_presigned_url_lambda(bucket, key, method, auth_token, content_type=None, expiration=3600):
    """
    Call the S3 presigned URL Lambda function via API Gateway.
    
    Lambda: lambda_s3_presigned_url.py
    Purpose: Generate presigned URLs for S3 GET/PUT operations
    
    Args:
        bucket (str): S3 bucket name
        key (str): S3 object key (including user path prefix)
        method (str): HTTP method ('get' or 'put')
        auth_token (str): JWT token
        content_type (str, optional): Content type for PUT operations
        expiration (int, optional): URL expiration in seconds (default 3600)
        
    Returns:
        dict: Response with presigned_url and metadata
        
    Example Response:
        {
            "success": true,
            "presigned_url": "https://s3.amazonaws.com/...",
            "bucket": "my-bucket",
            "key": "users/user123/file.pdf",
            "method": "get",
            "expires_in": 3600
        }
    """
    endpoint = os.getenv('API_GATEWAY_S3_PRESIGNED_URL_ENDPOINT')
    
    request_body = {
        'bucket': bucket,
        'key': key,
        'method': method.lower(),
        'expiration': expiration
    }
    
    if content_type and method.lower() == 'put':
        request_body['contentType'] = content_type
    
    return _make_api_request(endpoint, 'POST', request_body, auth_token)


def call_s3_list_lambda(bucket, parent_folder, list_files, auth_token):
    """
    Call the S3 list folders/files Lambda function via API Gateway.
    
    Lambda: lambda_list_s3_folders.py
    Purpose: List folders or files in an S3 bucket
    
    Args:
        bucket (str): S3 bucket name
        parent_folder (str): Parent folder path (including user prefix)
        list_files (bool): True to list files, False to list folders
        auth_token (str): JWT token
        
    Returns:
        dict: Response with folders or files list
        
    Example Response (list_files=False):
        {
            "success": true,
            "folders": ["templates/", "reports/"]
        }
        
    Example Response (list_files=True):
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
    endpoint = os.getenv('API_GATEWAY_S3_LIST_FOLDERS_ENDPOINT')
    
    request_body = {
        'bucket': bucket,
        'parent_folder': parent_folder,
        'list_files': list_files
    }
    
    return _make_api_request(endpoint, 'POST', request_body, auth_token)


def call_textract_start_lambda(bucket, key, output_bucket, output_key_prefix, auth_token):
    """
    Call the start Textract analysis Lambda function via API Gateway.
    
    Lambda: lambda_start_textract_analysis.py
    Purpose: Start AWS Textract document analysis job
    
    Args:
        bucket (str): Source S3 bucket name
        key (str): Source S3 object key (PDF file)
        output_bucket (str): Output S3 bucket for results
        output_key_prefix (str): Output key prefix for results
        auth_token (str): JWT token
        
    Returns:
        dict: Response with job_id and status
        
    Example Response:
        {
            "success": true,
            "job_id": "abc123...",
            "status": "IN_PROGRESS",
            "output_location": "s3://bucket/prefix/"
        }
    """
    endpoint = os.getenv('API_GATEWAY_TEXTRACT_START_ENDPOINT')
    
    request_body = {
        'bucket': bucket,
        'key': key,
        'outputBucket': output_bucket,
        'outputKeyPrefix': output_key_prefix
    }
    
    return _make_api_request(endpoint, 'POST', request_body, auth_token)


def call_textract_get_results_lambda(job_id, auth_token, next_token=None):
    """
    Call the get Textract results Lambda function via API Gateway.
    
    Lambda: lambda_get_textract_results.py
    Purpose: Retrieve results from a Textract analysis job (single call)
    
    Args:
        job_id (str): Textract job ID
        auth_token (str): JWT token
        next_token (str, optional): Pagination token for large results
        
    Returns:
        dict: Response with job status and blocks
        
    Example Response:
        {
            "success": true,
            "job_status": "SUCCEEDED",
            "blocks": [...],
            "document_metadata": {...},
            "next_token": "...",  // Optional, if more results available
            "has_more_results": false
        }
    """
    endpoint = os.getenv('API_GATEWAY_TEXTRACT_GET_RESULTS_ENDPOINT')
    
    request_body = {
        'jobId': job_id
    }
    
    if next_token:
        request_body['nextToken'] = next_token
    
    return _make_api_request(endpoint, 'POST', request_body, auth_token, timeout=60)


def verify_endpoints_configured():
    """
    Verify that all required API Gateway endpoints are configured.
    
    Returns:
        dict: Status of each endpoint configuration
        
    Raises:
        ApiGatewayClientError: If critical endpoints are missing
    """
    endpoints = {
        'S3_PRESIGNED_URL': os.getenv('API_GATEWAY_S3_PRESIGNED_URL_ENDPOINT'),
        'S3_LIST_FOLDERS': os.getenv('API_GATEWAY_S3_LIST_FOLDERS_ENDPOINT'),
        'TEXTRACT_START': os.getenv('API_GATEWAY_TEXTRACT_START_ENDPOINT'),
        'TEXTRACT_GET_RESULTS': os.getenv('API_GATEWAY_TEXTRACT_GET_RESULTS_ENDPOINT'),
    }
    
    missing = [name for name, url in endpoints.items() if not url]
    
    if missing:
        error_msg = f"Missing API Gateway endpoint configuration: {', '.join(missing)}"
        logger.error(error_msg)
        raise ApiGatewayClientError(error_msg)
    
    logger.info("All API Gateway endpoints configured")
    return {name: bool(url) for name, url in endpoints.items()}
