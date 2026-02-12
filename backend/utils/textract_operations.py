"""
Textract Operations Module

This module orchestrates AWS Textract document analysis operations by calling
API Gateway Lambda functions. It handles:
1. Starting Textract analysis jobs
2. Retrieving single-page results
3. Server-side polling for job completion
4. Fetching aggregated results from S3

Functions use JWT tokens for authentication and user path building.
"""

import time
import requests
import logging
from utils.jwt_helper import extract_user_id
from utils.api_gateway_client import (
    call_textract_start_lambda,
    call_textract_get_results_lambda,
    call_s3_list_lambda,
    call_s3_presigned_url_lambda,
    ApiGatewayClientError
)

logger = logging.getLogger(__name__)


class TextractOperationError(Exception):
    """Custom exception for Textract operation errors"""
    pass


def start_textract_analysis(bucket, key, output_bucket, output_key_prefix, auth_token, user_id=None):
    """
    Start AWS Textract document analysis job.
    
    Args:
        bucket (str): Source S3 bucket containing the PDF
        key (str): S3 key of the PDF file (can include or exclude user prefix)
        output_bucket (str): Output bucket for Textract results
        output_key_prefix (str): Output key prefix for results
        auth_token (str): JWT token
        user_id (str, optional): User ID (extracted from token if not provided)
        
    Returns:
        dict: Job information
        
    Example:
        {
            "success": true,
            "job_id": "abc123...",
            "status": "IN_PROGRESS",
            "output_location": "s3://bucket/prefix/",
            "document": {
                "bucket": "my-bucket",
                "key": "users/user123/pdfs/file.pdf"
            }
        }
    """
    try:
        # Extract user_id if not provided
        if not user_id:
            user_id = extract_user_id(auth_token)
        
        # Validate required parameters
        if not key:
            raise TextractOperationError("S3 key is required")
        if not bucket:
            raise TextractOperationError("S3 bucket is required")
        if not output_bucket:
            raise TextractOperationError("Output bucket is required")
        
        # Build full S3 keys with user prefix if not already included
        if not key.startswith(f'users/{user_id}/'):
            key = f'users/{user_id}/{key}'
        
        # Handle None or empty output_key_prefix
        if not output_key_prefix:
            output_key_prefix = 'textract/'
        
        if not output_key_prefix.startswith(f'users/{user_id}/'):
            output_key_prefix = f'users/{user_id}/{output_key_prefix}'
        
        logger.info(f"Starting Textract analysis: {bucket}/{key}")
        
        # Call Lambda via API Gateway
        response = call_textract_start_lambda(
            bucket=bucket,
            key=key,
            output_bucket=output_bucket,
            output_key_prefix=output_key_prefix,
            auth_token=auth_token
        )
        
        # Lambda returns data directly (errors would have raised ApiGatewayClientError)
        # Check for jobId (camelCase from Lambda)
        job_id = response.get('jobId') or response.get('job_id')
        if not job_id:
            logger.error(f"No jobId in response: {response}")
            raise TextractOperationError("No job_id returned from Textract")
        
        logger.info(f"Textract job started: {job_id}")
        
        # Normalize response to snake_case for Flask API consistency
        return {
            'success': True,
            'job_id': job_id,
            'status': response.get('status', 'IN_PROGRESS'),
            'output_location': response.get('outputLocation') or response.get('output_location'),
            'document': {
                'bucket': bucket,
                'key': key
            }
        }
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error starting Textract: {str(e)}")
        raise TextractOperationError(f"Failed to start Textract analysis: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error starting Textract: {str(e)}")
        raise TextractOperationError(f"Textract start failed: {str(e)}")


def get_textract_results(job_id, auth_token, next_token=None):
    """
    Get results from a Textract analysis job (single call, may be paginated).
    
    Args:
        job_id (str): Textract job ID
        auth_token (str): JWT token
        next_token (str, optional): Pagination token for large results
        
    Returns:
        dict: Job status and blocks
        
    Example:
        {
            "success": true,
            "job_status": "SUCCEEDED",
            "status_message": "Analysis completed",
            "blocks": [...],
            "document_metadata": {
                "pages": 5
            },
            "next_token": "...", # Optional if more results
            "has_more_results": false
        }
    """
    try:
        logger.info(f"Getting Textract results for job: {job_id}")
        
        # Call Lambda via API Gateway
        response = call_textract_get_results_lambda(
            job_id=job_id,
            auth_token=auth_token,
            next_token=next_token
        )
        
        # Lambda returns data directly (errors would have raised ApiGatewayClientError)
        # Check for jobStatus (camelCase from Lambda)
        job_status = response.get('jobStatus') or response.get('job_status')
        logger.info(f"Textract job status: {job_status}")
        
        # Normalize response to snake_case for Flask API consistency
        normalized_response = {
            'success': True,
            'job_status': job_status,
            'status_message': response.get('statusMessage') or response.get('status_message'),
        }
        
        # Add optional fields if present
        if 'blocks' in response or 'Blocks' in response:
            normalized_response['blocks'] = response.get('blocks') or response.get('Blocks', [])
        
        if 'documentMetadata' in response or 'document_metadata' in response or 'DocumentMetadata' in response:
            metadata = response.get('documentMetadata') or response.get('document_metadata') or response.get('DocumentMetadata')
            if metadata:
                normalized_response['document_metadata'] = {
                    'pages': metadata.get('Pages') or metadata.get('pages', 0)
                }
        
        if 'nextToken' in response or 'next_token' in response:
            next_token_val = response.get('nextToken') or response.get('next_token')
            if next_token_val:
                normalized_response['next_token'] = next_token_val
                normalized_response['has_more_results'] = True
            else:
                normalized_response['has_more_results'] = False
        else:
            normalized_response['has_more_results'] = False
        
        return normalized_response
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error getting Textract results: {str(e)}")
        raise TextractOperationError(f"Failed to get Textract results: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error getting Textract results: {str(e)}")
        raise TextractOperationError(f"Get results failed: {str(e)}")


def poll_textract_results(job_id, auth_token, poll_interval=10, max_attempts=60):
    """
    Poll Textract results until completion (server-side polling).
    
    This function repeatedly calls the Textract get results Lambda until
    the job is complete or fails. Polling logic is moved to the backend
    to reduce frontend network calls.
    
    Args:
        job_id (str): Textract job ID
        auth_token (str): JWT token
        poll_interval (int): Seconds between polling attempts (default 10)
        max_attempts (int): Maximum polling attempts (default 60 = 10 minutes)
        
    Returns:
        dict: Complete job results
        
    Example:
        {
            "success": true,
            "job_status": "SUCCEEDED",
            "blocks": [...],  # All paginated results combined
            "blocks_count": 1234,
            "document_metadata": {...},
            "polling_stats": {
                "attempts": 12,
                "duration_seconds": 60
            }
        }
    """
    try:
        logger.info(f"Starting server-side polling for job: {job_id}")
        start_time = time.time()
        all_blocks = []
        attempts = 0
        
        while attempts < max_attempts:
            attempts += 1
            
            # Get current status and results
            elapsed = time.time() - start_time
            logger.info(f"Poll attempt {attempts}/{max_attempts} (elapsed: {elapsed:.1f}s): Calling get_textract_results...")
            response = get_textract_results(job_id, auth_token)
            job_status = response.get('job_status')
            
            if not job_status:
                logger.error(f"No job_status in response: {response}")
                raise TextractOperationError("Missing job_status in Textract response")
            
            logger.info(f"Poll attempt {attempts}/{max_attempts} (elapsed: {elapsed:.1f}s): Status = {job_status}")
            logger.debug(f"Full response: {response}")
            
            # Check if job is complete
            if job_status == 'SUCCEEDED':
                # Collect all blocks (handle pagination)
                blocks = response.get('blocks', [])
                all_blocks.extend(blocks)
                
                # Check if there are more pages
                next_token = response.get('next_token')
                
                while next_token:
                    logger.info("Fetching next page of results...")
                    page_response = get_textract_results(job_id, auth_token, next_token)
                    page_blocks = page_response.get('blocks', [])
                    all_blocks.extend(page_blocks)
                    next_token = page_response.get('next_token')
                
                duration = time.time() - start_time
                logger.info(f"Textract job completed: {len(all_blocks)} blocks in {duration:.1f}s")
                
                return {
                    'success': True,
                    'job_status': 'SUCCEEDED',
                    'blocks': all_blocks,
                    'blocks_count': len(all_blocks),
                    'document_metadata': response.get('document_metadata', {}),
                    'polling_stats': {
                        'attempts': attempts,
                        'duration_seconds': int(duration)
                    }
                }
            
            elif job_status == 'FAILED':
                error_msg = response.get('status_message', 'Unknown error')
                logger.error(f"Textract job failed: {error_msg}")
                raise TextractOperationError(f"Textract analysis failed: {error_msg}")
            
            elif job_status == 'IN_PROGRESS':
                # Wait before next poll
                logger.info(f"Job still in progress, waiting {poll_interval} seconds before next poll...")
                if attempts < max_attempts:
                    time.sleep(poll_interval)
                    logger.info(f"Resuming polling (attempt {attempts + 1}/{max_attempts})...")
            
            else:
                logger.error(f"Unknown job status: {job_status}")
                raise TextractOperationError(f"Unknown job status: {job_status}")
        
        # Max attempts reached
        duration = time.time() - start_time
        logger.warning(f"Polling timeout after {attempts} attempts ({duration:.1f}s)")
        raise TextractOperationError(f"Textract polling timeout after {duration:.1f} seconds")
        
    except TextractOperationError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during polling: {str(e)}")
        raise TextractOperationError(f"Polling failed: {str(e)}")


def get_textract_results_from_s3(bucket, template_name, auth_token, user_id=None):
    """
    Fetch all Textract results from S3 for a template.
    
    This function:
    1. Lists all result files in the template's textract folder
    2. Gets presigned URLs for each file
    3. Downloads and aggregates all blocks
    
    Args:
        bucket (str): S3 bucket name
        template_name (str): Template name (used to build textract folder path)
        auth_token (str): JWT token
        user_id (str, optional): User ID (extracted from token if not provided)
        
    Returns:
        dict: Aggregated Textract results
        
    Example:
        {
            "success": true,
            "blocks": [...],  # Combined from all result files
            "blocks_count": 5678,
            "files_count": 3,
            "file_names": ["result1.json", "result2.json", "result3.json"]
        }
    """
    try:
        # Extract user_id if not provided
        if not user_id:
            user_id = extract_user_id(auth_token)
        
        # Build textract results folder path
        # Structure: users/{user_id}/templates/{template_id}/textract-jobs/
        template_folder = template_name.replace('.html', '').replace('.pdf', '')
        textract_prefix = f'users/{user_id}/templates/{template_folder}/textract-jobs/'
        
        logger.info(f"Fetching Textract results from S3: {bucket}/{textract_prefix}")
        
        # List all result files
        list_response = call_s3_list_lambda(
            bucket=bucket,
            parent_folder=textract_prefix,
            list_files=True,
            auth_token=auth_token
        )
        
        # Lambda returns data directly (errors would have raised ApiGatewayClientError)
        files = list_response.get('files', [])
        
        if not files:
            logger.warning(f"No Textract result files found in {textract_prefix}")
            return {
                'success': True,
                'blocks': [],
                'blocks_count': 0,
                'files_count': 0,
                'file_names': []
            }
        
        logger.info(f"Found {len(files)} Textract result files")
        
        # Download and aggregate all blocks
        all_blocks = []
        file_names = []
        
        for file_info in files:
            file_key = file_info.get('key')
            file_name = file_info.get('file_name')
            
            if not file_key:
                continue
            
            logger.info(f"Downloading result file: {file_name}")
            
            # Get presigned URL
            presigned_response = call_s3_presigned_url_lambda(
                bucket=bucket,
                key=file_key,
                method='get',
                auth_token=auth_token
            )
            
            # Check for presignedUrl (camelCase from Lambda)
            presigned_url = presigned_response.get('presignedUrl') or presigned_response.get('presigned_url')
            if not presigned_url:
                logger.warning(f"Failed to get presigned URL for {file_name}")
                continue
            
            # Download file content
            try:
                download_response = requests.get(presigned_url, timeout=30)
                
                if download_response.status_code == 200:
                    result_data = download_response.json()
                    blocks = result_data.get('Blocks', []) or result_data.get('blocks', [])
                    all_blocks.extend(blocks)
                    file_names.append(file_name)
                    logger.info(f"Downloaded {len(blocks)} blocks from {file_name}")
                else:
                    logger.warning(f"Failed to download {file_name}: HTTP {download_response.status_code}")
                    
            except Exception as e:
                logger.warning(f"Error downloading {file_name}: {str(e)}")
                continue
        
        logger.info(f"Aggregated {len(all_blocks)} total blocks from {len(file_names)} files")
        
        return {
            'success': True,
            'blocks': all_blocks,
            'blocks_count': len(all_blocks),
            'files_count': len(file_names),
            'file_names': file_names
        }
        
    except ApiGatewayClientError as e:
        logger.error(f"API Gateway error fetching Textract results from S3: {str(e)}")
        raise TextractOperationError(f"Failed to fetch Textract results from S3: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error fetching Textract results from S3: {str(e)}")
        raise TextractOperationError(f"S3 fetch failed: {str(e)}")
