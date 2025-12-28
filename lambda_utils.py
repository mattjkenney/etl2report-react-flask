"""
Utility functions for AWS Lambda functions.

This module contains reusable helper functions for Lambda proxy integrations,
including JWT token extraction and standardized error response creation.
"""

import json
import base64
import os
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
