"""
JWT Token Helper Module

This module provides utilities for extracting user information from JWT tokens.
Used by Flask backend to extract user_id (sub) for building S3 paths.

Note: This module does NOT validate JWT signatures. Token validation is handled
by API Gateway Cognito Authorizer before reaching Lambda functions. The Flask
backend only extracts the sub claim to construct user-specific S3 paths.

Security Flow:
1. Flask receives JWT from frontend in Authorization header
2. Flask extracts sub (user_id) using this module (no validation)
3. Flask uses user_id to build S3 paths: users/{user_id}/...
4. Flask passes original token to API Gateway
5. API Gateway validates token and provides sub to Lambda
6. Lambda uses validated sub from API Gateway authorizer context
"""

import jwt
import logging

logger = logging.getLogger(__name__)


def extract_user_id(token):
    """
    Extract user_id (sub claim) from JWT token without validation.
    
    This function decodes the JWT to extract the 'sub' claim which contains
    the user's unique identifier (user_id). It does NOT verify the signature
    because token validation is performed by API Gateway Cognito Authorizer.
    
    Args:
        token (str): The JWT token (without 'Bearer ' prefix)
        
    Returns:
        str: The user_id (sub claim) from the token
        
    Raises:
        ValueError: If token is invalid or missing sub claim
        
    Example:
        >>> token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        >>> user_id = extract_user_id(token)
        >>> print(user_id)  # "auth0|123456789"
    """
    try:
        # Decode JWT without signature verification
        # API Gateway will validate the signature later
        decoded = jwt.decode(token, options={"verify_signature": False})
        
        # Extract sub claim (user_id)
        user_id = decoded.get('sub')
        
        if not user_id:
            raise ValueError("JWT token missing 'sub' claim")
        
        logger.debug(f"Extracted user_id from token: {user_id}")
        return user_id
        
    except jwt.DecodeError as e:
        logger.error(f"Failed to decode JWT token: {str(e)}")
        raise ValueError(f"Invalid JWT token: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error extracting user_id: {str(e)}")
        raise ValueError(f"Failed to extract user_id from token: {str(e)}")


def extract_token_from_header(authorization_header):
    """
    Extract JWT token from Authorization header.
    
    Args:
        authorization_header (str): The Authorization header value (e.g., "Bearer <token>")
        
    Returns:
        str: The JWT token without 'Bearer ' prefix
        
    Raises:
        ValueError: If header is missing or invalid format
        
    Example:
        >>> header = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        >>> token = extract_token_from_header(header)
    """
    if not authorization_header:
        raise ValueError("Missing Authorization header")
    
    if not authorization_header.startswith('Bearer '):
        raise ValueError("Invalid Authorization header format. Expected 'Bearer <token>'")
    
    token = authorization_header.replace('Bearer ', '', 1)
    
    if not token:
        raise ValueError("Authorization header contains no token")
    
    return token


def get_user_path_prefix(token):
    """
    Get the S3 path prefix for a user based on their JWT token.
    
    This is a convenience function that extracts the user_id and formats
    it as an S3 path prefix following the pattern: users/{user_id}/
    
    Args:
        token (str): The JWT token (without 'Bearer ' prefix)
        
    Returns:
        str: The S3 path prefix for the user (e.g., "users/auth0|123456789/")
        
    Example:
        >>> token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        >>> prefix = get_user_path_prefix(token)
        >>> print(prefix)  # "users/auth0|123456789/"
    """
    user_id = extract_user_id(token)
    return f"users/{user_id}/"
