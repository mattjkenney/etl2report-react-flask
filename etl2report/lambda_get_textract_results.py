import json
import os
from typing import Any
import boto3
from botocore.exceptions import ClientError
from lambda_utils import create_response, get_client_with_assumed_role


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AWS Lambda function to get Textract document analysis results.
    
    This function is designed to be invoked via API Gateway as a Lambda proxy.
    It expects the following in the request body:
    - jobId: The Textract job ID from start_document_analysis
    - nextToken (optional): Token for retrieving the next page of results
    
    The function will:
    1. Get the document analysis status and results
    2. Handle pagination if results span multiple pages
    3. Return complete or partial results with nextToken if more pages exist
    
    Returns:
    - jobStatus: Current status of the job (IN_PROGRESS, SUCCEEDED, FAILED, PARTIAL_SUCCESS)
    - statusMessage: Additional status information (if available)
    - blocks: Array of document blocks (if job is complete)
    - documentMetadata: Document information (page count, etc.)
    - nextToken: Token for retrieving the next page (if more results exist)
    - analyzeDocumentModelVersion: Version of the Textract model used
    """
    
    try:
        # Extract user ID from Cognito authorizer claims
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        user_id = claims.get('sub')
        
        if not user_id:
            return create_response(401, {'error': 'Invalid or missing user ID from authorization'})
        
        # Get the Textract role ARN from environment variables
        textract_role_arn = os.environ.get('TEXTRACT_ROLE_ARN')
        if not textract_role_arn:
            return create_response(500, {'error': 'TEXTRACT_ROLE_ARN environment variable not set'})
        
        # Initialize Textract client with assumed role
        textract_client = get_client_with_assumed_role('textract', textract_role_arn, user_id)
        
        # Parse the request body
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body', {})
        
        # Extract required parameters
        job_id = body.get('jobId')
        next_token = body.get('nextToken')
        
        # Validate required parameters
        if not job_id:
            return create_response(400, {'error': 'Missing required parameter: jobId'})
        
        # Prepare GetDocumentAnalysis parameters
        get_params: dict[str, Any] = {
            'JobId': job_id
        }
        
        # Add NextToken if provided for pagination
        if next_token:
            get_params['NextToken'] = next_token
        
        # Get the document analysis results
        response = textract_client.get_document_analysis(**get_params)
        
        # Extract relevant fields from response
        job_status = response.get('JobStatus')
        status_message = response.get('StatusMessage', '')
        
        # Build response data
        response_data: dict[str, Any] = {
            'jobStatus': job_status
        }
        
        # Add status message if present
        if status_message:
            response_data['statusMessage'] = status_message
        
        # If job is still in progress, return status only
        if job_status == 'IN_PROGRESS':
            return create_response(200, response_data)
        
        # If job failed, return error details
        if job_status == 'FAILED':
            return create_response(200, {
                'jobStatus': job_status,
                'statusMessage': status_message,
                'error': 'Textract analysis job failed'
            })
        
        # Job succeeded - include analysis results
        if job_status in ['SUCCEEDED', 'PARTIAL_SUCCESS']:
            # Add document metadata
            if 'DocumentMetadata' in response:
                response_data['documentMetadata'] = response['DocumentMetadata']
            
            # Add blocks (the actual analysis results)
            if 'Blocks' in response:
                response_data['blocks'] = response['Blocks']
            
            # Add model version
            if 'AnalyzeDocumentModelVersion' in response:
                response_data['analyzeDocumentModelVersion'] = response['AnalyzeDocumentModelVersion']
            
            # Add NextToken if there are more results (pagination)
            if 'NextToken' in response:
                response_data['nextToken'] = response['NextToken']
                response_data['hasMoreResults'] = True
            else:
                response_data['hasMoreResults'] = False
            
            # Add warnings if present
            if 'Warnings' in response:
                response_data['warnings'] = response['Warnings']
            
            return create_response(200, response_data)
        
        # Unknown status
        return create_response(500, {
            'error': 'Unknown job status',
            'jobStatus': job_status,
            'statusMessage': status_message
        })
        
    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON in request body'})
    
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        
        if error_code == 'InvalidParameterException':
            return create_response(400, {
                'error': 'Invalid parameters provided',
                'details': error_message
            })
        elif error_code == 'InvalidJobIdException':
            return create_response(404, {
                'error': 'Invalid job ID',
                'details': error_message
            })
        elif error_code == 'AccessDeniedException':
            return create_response(403, {
                'error': 'Access denied',
                'details': error_message
            })
        elif error_code == 'InternalServerError':
            return create_response(500, {
                'error': 'Textract service error',
                'details': error_message
            })
        elif error_code == 'ProvisionedThroughputExceededException':
            return create_response(429, {
                'error': 'Rate limit exceeded',
                'details': error_message
            })
        elif error_code == 'InvalidS3ObjectException':
            return create_response(400, {
                'error': 'Invalid S3 object',
                'details': error_message
            })
        else:
            return create_response(500, {
                'error': 'AWS service error',
                'errorCode': error_code,
                'details': error_message
            })
    
    except Exception as e:
        return create_response(500, {
            'error': 'Internal server error',
            'details': str(e)
        })
