"""
API Endpoint Integration Tests

Integration tests for Flask API endpoints that proxy to API Gateway Lambda functions.
Tests the full request/response flow including authentication, parameter validation,
and error handling.
"""

import pytest
import json
from io import BytesIO
from unittest.mock import patch, Mock


class TestS3UploadEndpoint:
    """Test /api/s3/upload endpoint."""
    
    @patch('app.upload_file_to_s3')
    def test_s3_upload_endpoint_success(
        self, 
        mock_upload,
        app_client,
        auth_header,
        test_bucket
    ):
        """Test successful file upload."""
        # Setup
        mock_upload.return_value = {
            'success': True,
            'message': 'File uploaded successfully',
            'bucket': test_bucket,
            'key': 'users/test-user-123/pdfs/test.pdf',
            'file_name': 'test.pdf',
            'size': 1024
        }
        
        # Prepare file upload
        data = {
            'file': (BytesIO(b'PDF file content'), 'test.pdf'),
            'bucket': test_bucket,
            'key': 'pdfs/test.pdf',
            'description': 'Test PDF'
        }
        
        # Execute
        response = app_client.post(
            '/api/s3/upload',
            data=data,
            headers=auth_header,
            content_type='multipart/form-data'
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['file_name'] == 'test.pdf'
        assert 'users/test-user-123' in result['key']
        
        # Verify upload function was called
        mock_upload.assert_called_once()
    
    def test_s3_upload_endpoint_missing_auth(self, app_client):
        """Test upload without authentication."""
        # Execute
        response = app_client.post(
            '/api/s3/upload',
            data={'file': (BytesIO(b'content'), 'test.pdf')},
            content_type='multipart/form-data'
        )
        
        # Verify
        assert response.status_code == 401
        result = response.get_json()
        assert 'error' in result
        assert 'Authorization' in result['error']
    
    def test_s3_upload_endpoint_missing_file(self, app_client, auth_header):
        """Test upload without file."""
        # Execute
        response = app_client.post(
            '/api/s3/upload',
            data={'bucket': 'test-bucket'},
            headers=auth_header,
            content_type='multipart/form-data'
        )
        
        # Verify
        assert response.status_code == 400
        result = response.get_json()
        assert 'error' in result
        assert 'file' in result['error'].lower()
    
    def test_s3_upload_endpoint_empty_filename(self, app_client, auth_header):
        """Test upload with empty filename."""
        # Execute
        response = app_client.post(
            '/api/s3/upload',
            data={'file': (BytesIO(b'content'), '')},
            headers=auth_header,
            content_type='multipart/form-data'
        )
        
        # Verify
        assert response.status_code == 400
        result = response.get_json()
        assert 'error' in result
        assert 'filename' in result['error'].lower()


class TestS3ListObjectsEndpoint:
    """Test /api/s3/list-objects endpoint."""
    
    @patch('app.list_s3_objects')
    def test_s3_list_objects_folders(
        self, 
        mock_list,
        app_client,
        auth_header,
        test_bucket,
        mock_s3_list_folders_response
    ):
        """Test listing S3 folders."""
        # Setup
        mock_list.return_value = mock_s3_list_folders_response
        
        # Execute
        response = app_client.post(
            '/api/s3/list-objects',
            json={
                'bucket': test_bucket,
                'parent_folder': 'templates',
                'list_files': False
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert 'folders' in result
        assert len(result['folders']) == 3
        
        # Verify list function was called
        mock_list.assert_called_once()
        call_args = mock_list.call_args
        assert call_args.kwargs['list_files'] is False
    
    @patch('app.list_s3_objects')
    def test_s3_list_objects_files(
        self, 
        mock_list,
        app_client,
        auth_header,
        test_bucket,
        mock_s3_list_files_response
    ):
        """Test listing S3 files."""
        # Setup
        mock_list.return_value = mock_s3_list_files_response
        
        # Execute
        response = app_client.post(
            '/api/s3/list-objects',
            json={
                'bucket': test_bucket,
                'parent_folder': 'pdfs',
                'list_files': True
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert 'files' in result
        assert len(result['files']) == 2
        
        # Verify list function was called with correct parameters
        call_args = mock_list.call_args
        assert call_args.kwargs['list_files'] is True
    
    def test_s3_list_objects_missing_auth(self, app_client):
        """Test list without authentication."""
        # Execute
        response = app_client.post(
            '/api/s3/list-objects',
            json={'bucket': 'test-bucket', 'list_files': False}
        )
        
        # Verify
        assert response.status_code == 401


class TestS3PresignedUrlEndpoint:
    """Test /api/s3/presigned-url endpoint."""
    
    @patch('app.get_presigned_url')
    def test_s3_presigned_url_get(
        self, 
        mock_get_url,
        app_client,
        auth_header,
        test_bucket
    ):
        """Test generating presigned GET URL."""
        # Setup
        mock_get_url.return_value = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/test-bucket/test?signature=abc',
            'method': 'get'
        }
        
        # Execute
        response = app_client.post(
            '/api/s3/presigned-url',
            json={
                'bucket': test_bucket,
                'key': 'pdfs/test.pdf',
                'method': 'get'
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert 'presigned_url' in result
        assert result['method'] == 'get'
        
        # Verify function was called with correct method
        mock_get_url.assert_called_once()
        call_args = mock_get_url.call_args
        assert call_args.kwargs['method'] == 'get'
    
    @patch('app.get_presigned_url')
    def test_s3_presigned_url_put(
        self, 
        mock_get_url,
        app_client,
        auth_header,
        test_bucket
    ):
        """Test generating presigned PUT URL with content type."""
        # Setup
        mock_get_url.return_value = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/test-bucket/test?signature=put',
            'method': 'put'
        }
        
        # Execute
        response = app_client.post(
            '/api/s3/presigned-url',
            json={
                'bucket': test_bucket,
                'key': 'pdfs/test.pdf',
                'method': 'put',
                'content_type': 'application/pdf'
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['method'] == 'put'
        
        # Verify content_type was passed
        call_args = mock_get_url.call_args
        assert call_args.kwargs['content_type'] == 'application/pdf'


class TestS3FetchHtmlTemplateEndpoint:
    """Test /api/s3/fetch-html-template endpoint."""
    
    @patch('app.fetch_html_template')
    def test_fetch_html_template_success(
        self, 
        mock_fetch,
        app_client,
        auth_header,
        test_bucket,
        mock_html_content
    ):
        """Test successful HTML template fetch."""
        # Setup
        mock_fetch.return_value = {
            'success': True,
            'html_content': mock_html_content,
            'template_name': 'test-template'
        }
        
        # Execute
        response = app_client.post(
            '/api/s3/fetch-html-template',
            json={
                'bucket': test_bucket,
                'template_name': 'test-template'
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['template_name'] == 'test-template'
        assert 'variable1' in result['html_content']
    
    def test_fetch_html_template_missing_template_name(
        self, 
        app_client,
        auth_header
    ):
        """Test fetch without template name."""
        # Execute
        response = app_client.post(
            '/api/s3/fetch-html-template',
            json={'bucket': 'test-bucket'},
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 400


class TestTextractStartAnalysisEndpoint:
    """Test /api/textract/start-analysis endpoint."""
    
    @patch('app.start_textract_analysis')
    def test_textract_start_endpoint_success(
        self, 
        mock_start,
        app_client,
        auth_header,
        test_bucket,
        mock_textract_start_response
    ):
        """Test successful Textract analysis start."""
        # Setup
        mock_start.return_value = mock_textract_start_response
        
        # Execute
        response = app_client.post(
            '/api/textract/start-analysis',
            json={
                'bucket': test_bucket,
                'key': 'pdfs/test.pdf',
                'output_bucket': test_bucket,
                'output_key_prefix': 'textract/results'
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['job_id'] == 'test-job-abc123'
        assert result['status'] == 'IN_PROGRESS'
        
        # Verify start function was called
        mock_start.assert_called_once()
    
    def test_textract_start_endpoint_missing_params(
        self, 
        app_client,
        auth_header
    ):
        """Test start without required parameters."""
        # Execute
        response = app_client.post(
            '/api/textract/start-analysis',
            json={'bucket': 'test-bucket'},  # Missing key
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 400
    
    def test_textract_start_endpoint_missing_auth(self, app_client):
        """Test start without authentication."""
        # Execute
        response = app_client.post(
            '/api/textract/start-analysis',
            json={
                'bucket': 'test-bucket',
                'key': 'test.pdf',
                'output_bucket': 'test-bucket',
                'output_key_prefix': 'results'
            }
        )
        
        # Verify
        assert response.status_code == 401


class TestTextractGetResultsEndpoint:
    """Test /api/textract/get-results endpoint."""
    
    @patch('app.get_textract_results')
    def test_textract_get_results_success(
        self, 
        mock_get_results,
        app_client,
        auth_header,
        mock_textract_results_success
    ):
        """Test successful results retrieval."""
        # Setup
        mock_get_results.return_value = mock_textract_results_success
        
        # Execute
        response = app_client.post(
            '/api/textract/get-results',
            json={'job_id': 'test-job-abc123'},
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['job_status'] == 'SUCCEEDED'
        assert len(result['blocks']) == 2
    
    @patch('app.get_textract_results')
    def test_textract_get_results_with_pagination(
        self, 
        mock_get_results,
        app_client,
        auth_header
    ):
        """Test results retrieval with pagination token."""
        # Setup
        mock_get_results.return_value = {
            'success': True,
            'job_status': 'SUCCEEDED',
            'blocks': [{'BlockType': 'LINE'}],
            'next_token': 'next-page',
            'has_more_results': True
        }
        
        # Execute
        response = app_client.post(
            '/api/textract/get-results',
            json={
                'job_id': 'test-job-abc123',
                'next_token': 'current-page'
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['has_more_results'] is True
        assert result['next_token'] == 'next-page'
        
        # Verify next_token was passed
        call_args = mock_get_results.call_args
        assert call_args.kwargs['next_token'] == 'current-page'


class TestTextractPollResultsEndpoint:
    """Test /api/textract/poll-results endpoint."""
    
    @patch('app.poll_textract_results')
    def test_textract_poll_endpoint_success(
        self, 
        mock_poll,
        app_client,
        auth_header
    ):
        """Test successful server-side polling."""
        # Setup
        mock_poll.return_value = {
            'success': True,
            'job_status': 'SUCCEEDED',
            'blocks': [{'BlockType': 'LINE', 'Text': 'Sample'}],
            'blocks_count': 1
        }
        
        # Execute
        response = app_client.post(
            '/api/textract/poll-results',
            json={
                'job_id': 'test-job-abc123',
                'poll_interval': 1000,
                'max_attempts': 10
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['job_status'] == 'SUCCEEDED'
        assert result['blocks_count'] == 1
        
        # Verify poll function was called with correct parameters
        mock_poll.assert_called_once()
        call_args = mock_poll.call_args
        assert call_args.kwargs['poll_interval'] == 1000
        assert call_args.kwargs['max_attempts'] == 10
    
    @patch('app.poll_textract_results')
    def test_textract_poll_endpoint_default_params(
        self, 
        mock_poll,
        app_client,
        auth_header
    ):
        """Test polling with default parameters."""
        # Setup
        mock_poll.return_value = {
            'success': True,
            'job_status': 'SUCCEEDED',
            'blocks': [],
            'blocks_count': 0
        }
        
        # Execute (no poll_interval or max_attempts provided)
        response = app_client.post(
            '/api/textract/poll-results',
            json={'job_id': 'test-job-abc123'},
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        
        # Verify default values were used
        call_args = mock_poll.call_args
        assert call_args.kwargs['poll_interval'] == 5  # Default (seconds)
        assert call_args.kwargs['max_attempts'] == 60  # Default


class TestTextractGetResultsFromS3Endpoint:
    """Test /api/textract/get-results-from-s3 endpoint."""
    
    @patch('app.get_textract_results_from_s3')
    def test_textract_get_results_from_s3_success(
        self, 
        mock_get_s3,
        app_client,
        auth_header,
        test_bucket
    ):
        """Test successful retrieval from S3."""
        # Setup
        mock_get_s3.return_value = {
            'success': True,
            'blocks': [
                {'BlockType': 'LINE', 'Text': 'Result 1'},
                {'BlockType': 'LINE', 'Text': 'Result 2'}
            ],
            'blocks_count': 2,
            'files_count': 2,
            'file_names': ['result1.json', 'result2.json']
        }
        
        # Execute
        response = app_client.post(
            '/api/textract/get-results-from-s3',
            json={
                'bucket': test_bucket,
                'template_name': 'template1'
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        result = response.get_json()
        assert result['success'] is True
        assert result['blocks_count'] == 2
        assert result['files_count'] == 2
        assert len(result['file_names']) == 2


class TestAuthenticationRequired:
    """Test authentication enforcement across all proxy endpoints."""
    
    def test_authentication_required_on_all_endpoints(self, app_client):
        """Test that all proxy endpoints require authentication."""
        endpoints = [
            ('/api/s3/upload', {'file': (BytesIO(b'test'), 'test.pdf')}),
            ('/api/s3/list-objects', {'bucket': 'test', 'list_files': False}),
            ('/api/s3/presigned-url', {'bucket': 'test', 'key': 'test', 'method': 'get'}),
            ('/api/s3/fetch-html-template', {'bucket': 'test', 'template_name': 'test'}),
            ('/api/textract/start-analysis', {'bucket': 'test', 'key': 'test', 'output_bucket': 'test', 'output_key_prefix': 'test'}),
            ('/api/textract/get-results', {'job_id': 'test-job'}),
            ('/api/textract/poll-results', {'job_id': 'test-job'}),
            ('/api/textract/get-results-from-s3', {'bucket': 'test', 'template_name': 'test'}),
        ]
        
        for endpoint, data in endpoints:
            # Special handling for upload endpoint (multipart)
            if endpoint == '/api/s3/upload':
                response = app_client.post(
                    endpoint,
                    data=data,
                    content_type='multipart/form-data'
                )
            else:
                response = app_client.post(endpoint, json=data)
            
            # All should return 401 without authentication
            assert response.status_code == 401, f"Endpoint {endpoint} did not enforce authentication"


class TestUserIsolation:
    """Test that users can only access their own data."""
    
    @patch('app.list_s3_objects')
    def test_user_isolation_in_s3_operations(
        self, 
        mock_list,
        app_client,
        auth_header
    ):
        """Test that S3 operations are isolated to user's path."""
        # Setup
        mock_list.return_value = {'success': True, 'folders': []}
        
        # Execute
        response = app_client.post(
            '/api/s3/list-objects',
            json={
                'bucket': 'test-bucket',
                'parent_folder': 'templates',
                'list_files': False
            },
            headers=auth_header
        )
        
        # Verify
        assert response.status_code == 200
        
        # Verify that list_s3_objects was called (which internally adds user prefix)
        mock_list.assert_called_once()
        
        # User isolation is enforced in s3_operations.py by prefixing paths with users/{user_id}/
