"""
Test Configuration and Fixtures

Provides shared fixtures for all backend tests including:
- Mock JWT tokens
- Mock AWS responses
- Test Flask app client
"""

import pytest
import jwt
from datetime import datetime, timedelta
from flask import Flask
from unittest.mock import Mock, MagicMock


@pytest.fixture
def mock_jwt_token():
    """Generate a mock JWT token for testing."""
    payload = {
        'sub': 'test-user-123',
        'email': 'test@example.com',
        'exp': datetime.utcnow() + timedelta(hours=1),
        'iat': datetime.utcnow()
    }
    # Create an unsigned token (verification disabled in backend)
    token = jwt.encode(payload, 'secret', algorithm='HS256')
    return token


@pytest.fixture
def test_user_id():
    """Standard test user ID."""
    return 'test-user-123'


@pytest.fixture
def test_bucket():
    """Standard test S3 bucket name."""
    return 'test-bucket'


@pytest.fixture
def auth_header(mock_jwt_token):
    """Authorization header with Bearer token."""
    return {'Authorization': f'Bearer {mock_jwt_token}'}


@pytest.fixture
def mock_s3_presigned_url_response():
    """Mock response from S3 presigned URL Lambda."""
    return {
        'success': True,
        'presigned_url': 'https://s3.amazonaws.com/test-bucket/test-key?signature=abc123',
        'bucket': 'test-bucket',
        'key': 'users/test-user-123/pdfs/test.pdf',
        'method': 'put',
        'expiration': 3600
    }


@pytest.fixture
def mock_s3_list_folders_response():
    """Mock response from S3 list folders Lambda."""
    return {
        'success': True,
        'folders': [
            'users/test-user-123/templates/template1/',
            'users/test-user-123/templates/template2/',
            'users/test-user-123/templates/template3/'
        ]
    }


@pytest.fixture
def mock_s3_list_files_response():
    """Mock response from S3 list files Lambda."""
    return {
        'success': True,
        'files': [
            {
                'file_name': 'test1.pdf',
                'key': 'users/test-user-123/pdfs/test1.pdf',
                'size': 12345,
                'last_modified': '2024-01-01T12:00:00Z'
            },
            {
                'file_name': 'test2.pdf',
                'key': 'users/test-user-123/pdfs/test2.pdf',
                'size': 67890,
                'last_modified': '2024-01-02T12:00:00Z'
            }
        ]
    }


@pytest.fixture
def mock_textract_start_response():
    """Mock response from Textract start analysis Lambda."""
    return {
        'success': True,
        'job_id': 'test-job-abc123',
        'status': 'IN_PROGRESS',
        'output_location': 's3://test-bucket/users/test-user-123/textract/test-job-abc123/',
        'document': {
            'bucket': 'test-bucket',
            'key': 'users/test-user-123/pdfs/test.pdf'
        }
    }


@pytest.fixture
def mock_textract_results_in_progress():
    """Mock Textract results response (job still in progress)."""
    return {
        'success': True,
        'job_status': 'IN_PROGRESS',
        'status_message': 'Job is still processing',
        'blocks': [],
        'document_metadata': {},
        'has_more_results': False
    }


@pytest.fixture
def mock_textract_results_success():
    """Mock Textract results response (job completed)."""
    return {
        'success': True,
        'job_status': 'SUCCEEDED',
        'status_message': 'Job completed successfully',
        'blocks': [
            {
                'BlockType': 'LINE',
                'Text': 'Sample text line 1',
                'Confidence': 99.5,
                'Geometry': {
                    'BoundingBox': {
                        'Width': 0.5,
                        'Height': 0.02,
                        'Left': 0.1,
                        'Top': 0.1
                    }
                }
            },
            {
                'BlockType': 'LINE',
                'Text': 'Sample text line 2',
                'Confidence': 98.7,
                'Geometry': {
                    'BoundingBox': {
                        'Width': 0.6,
                        'Height': 0.02,
                        'Left': 0.1,
                        'Top': 0.15
                    }
                }
            }
        ],
        'document_metadata': {
            'Pages': 1
        },
        'has_more_results': False
    }


@pytest.fixture
def mock_html_content():
    """Mock HTML template content."""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Template</title>
    </head>
    <body>
        <h1>{{variable1}}</h1>
        <p>{{variable2}}</p>
    </body>
    </html>
    """


@pytest.fixture
def app_client():
    """Create Flask test client."""
    from app import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client
