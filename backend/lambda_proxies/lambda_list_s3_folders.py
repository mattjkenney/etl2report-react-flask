"""
AWS Lambda function to list sub-folders or files in an S3 bucket.

This function retrieves a list of all sub-folder names OR all file objects within 
a specified parent folder in an S3 bucket, using tenant-scoped IAM role assumption for security.
"""

import os
import json
from lambda_utils import create_response, get_client_with_assumed_role


def lambda_handler(event, context):
    """
    List all sub-folders or files in an S3 bucket under a specified parent folder.
    
    Expected event structure:
    {
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": "user-id-from-cognito"
                }
            }
        },
        "body": {
            "bucket": "my-bucket-name",
            "parent_folder": "documents",
            "list_files": false  // optional, defaults to false (lists folders only)
        }
    }
    
    Parameters:
        - list_files: If true, lists all file objects in the folder. 
                     If false (default), lists only sub-directory folder names.
    
    Returns:
        Lambda proxy response with list of folder names (if list_files=false)
        or list of file objects with keys and metadata (if list_files=true)
    """
    try:
        # Extract user_id from API Gateway request context
        request_context = event.get('requestContext', {})
        authorizer = request_context.get('authorizer', {})
        claims = authorizer.get('claims', {})
        user_id = claims.get('sub')
        
        if not user_id:
            return create_response(401, {
                'error': 'Missing user_id from authorizer'
            })
        
        # Parse request body
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)
        
        # Extract required parameters
        bucket = body.get('bucket')
        parent_folder = body.get('parent_folder', '')
        list_files = body.get('list_files', False)  # Default to listing folders only
        
        if not bucket:
            return create_response(400, {
                'error': 'Missing required parameter: bucket'
            })
        
        # Get environment variables
        role_arn = os.environ.get('ROLE_ARN')
        if not role_arn:
            return create_response(500, {
                'error': 'ROLE_ARN environment variable not configured'
            })
        
        print(f"Listing {'files' if list_files else 'folders'} in bucket: {bucket}, prefix: {parent_folder}")
        
        # Get S3 client with assumed role
        s3_client = get_client_with_assumed_role(
            service_name='s3',
            role_arn=role_arn,
            tenant_id=user_id
        )
        
        paginator = s3_client.get_paginator('list_objects_v2')
        
        if list_files:
            # List all file objects (no delimiter)
            files = []
            for page in paginator.paginate(Bucket=bucket, Prefix=parent_folder):
                # Contents contains the actual objects/files
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    # Skip the folder itself (keys ending with /)
                    if not key.endswith('/'):
                        files.append({
                            'key': key,
                            'fileName': key.split('/')[-1],
                            'size': obj.get('Size', 0),
                            'lastModified': obj.get('LastModified').isoformat() if obj.get('LastModified') else None
                        })
            
            # Sort by key
            files.sort(key=lambda x: x['key'])
            
            print(f"Found {len(files)} files")
            
            return create_response(200, {
                'files': files,
                'bucket': bucket,
                'parent_folder': parent_folder,
                'count': len(files)
            })
        else:
            # List only sub-directory folder names (use delimiter)
            folders = set()
            
            # Use delimiter='/' to get folder-like structure
            for page in paginator.paginate(Bucket=bucket, Prefix=parent_folder, Delimiter='/'):
                # CommonPrefixes contains the "folder" names
                for prefix_info in page.get('CommonPrefixes', []):
                    folder_prefix = prefix_info['Prefix']
                    # Extract just the folder name (remove the parent path and trailing slash)
                    folder_name = folder_prefix.rstrip('/').split('/')[-1]
                    if folder_name:
                        folders.add(folder_name)
            
            # Convert set to sorted list
            folder_list = sorted(list(folders))
            
            print(f"Found {len(folder_list)} folders: {folder_list}")
            
            return create_response(200, {
                'folders': folder_list,
                'bucket': bucket,
                'parent_folder': parent_folder,
            })
        
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {str(e)}")
        return create_response(400, {
            'error': 'Invalid JSON in request body'
        })
    except Exception as e:
        print(f"Error listing folders: {str(e)}")
        return create_response(500, {
            'error': f'Failed to list folders: {str(e)}'
        })
