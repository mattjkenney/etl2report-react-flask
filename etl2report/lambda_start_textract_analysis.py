import json
import os
from typing import Any
from lambda_utils import create_response, get_client_with_assumed_role


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """
    AWS Lambda function to start Textract document analysis.
    
    This function is designed to be invoked via API Gateway as a Lambda proxy.
    It expects the following in the request body:
    - bucket: S3 bucket name containing the document
    - key: S3 object key (file path) of the document
    - outputBucket: S3 bucket name for Textract output
    - outputKeyPrefix: S3 object key prefix for Textract output
    
    The function will start an asynchronous Textract document analysis and
    configure Textract to output results to an S3 location.
    
    Returns:
    - jobId: The Textract job ID for tracking the analysis
    - status: Success message
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
        bucket = body.get('bucket')
        key = body.get('key')
        output_bucket = body.get('outputBucket')
        output_key_prefix = body.get('outputKeyPrefix')
        
        # Validate required parameters
        if not bucket:
            return create_response(400, {'error': 'Missing required parameter: bucket'})
        
        if not key:
            return create_response(400, {'error': 'Missing required parameter: key'})
        
        if not output_bucket:
            return create_response(400, {'error': 'Missing required parameter: outputBucket'})
        
        if not output_key_prefix:
            return create_response(400, {'error': 'Missing required parameter: outputKeyPrefix'})
        
        # Prepare StartDocumentAnalysis parameters
        start_params: dict[str, Any] = {
            'DocumentLocation': {
                'S3Object': {
                    'Bucket': bucket,
                    'Name': key
                }
            },
            'FeatureTypes': ['TABLES', 'FORMS', 'LAYOUT', 'SIGNATURES'],
            'OutputConfig': {
                'S3Bucket': output_bucket,
                'S3Prefix': output_key_prefix
            }
        }
        
        # Start the document analysis
        response = textract_client.start_document_analysis(**start_params)
        
        # Extract the job ID
        job_id = response.get('JobId')
        
        if not job_id:
            return create_response(500, {
                'error': 'Failed to start Textract analysis: No job ID returned'
            })
        
        # Return success response
        return create_response(200, {
            'jobId': job_id,
            'status': 'Analysis started successfully',
            'outputLocation': {
                'bucket': output_bucket,
                'keyPrefix': output_key_prefix
            }
        })
        
    except json.JSONDecodeError:
        return create_response(400, {'error': 'Invalid JSON in request body'})
    
    except textract_client.exceptions.InvalidParameterException as e:
        return create_response(400, {
            'error': 'Invalid parameters provided',
            'details': str(e)
        })
    
    except textract_client.exceptions.InvalidS3ObjectException as e:
        return create_response(400, {
            'error': 'Invalid S3 object',
            'details': str(e)
        })
    
    except textract_client.exceptions.DocumentTooLargeException as e:
        return create_response(400, {
            'error': 'Document exceeds size limit',
            'details': str(e)
        })
    
    except textract_client.exceptions.UnsupportedDocumentException as e:
        return create_response(400, {
            'error': 'Unsupported document format',
            'details': str(e)
        })
    
    except Exception as e:
        return create_response(500, {
            'error': 'Internal server error',
            'details': str(e)
        })
