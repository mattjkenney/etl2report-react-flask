"""
S3 Service Unit Tests

Tests for s3_operations.py functions that orchestrate S3 operations
via API Gateway Lambda functions.
"""

import pytest
from unittest.mock import patch, Mock, MagicMock
from utils.s3_operations import (
    upload_file_to_s3,
    list_s3_objects,
    get_presigned_url,
    fetch_html_template,
    S3OperationError
)
from utils.api_gateway_client import ApiGatewayClientError


class TestUploadFileToS3:
    """Test upload_file_to_s3 function."""
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.requests.put')
    @patch('utils.s3_operations.extract_user_id')
    def test_upload_file_to_s3_success(
        self, 
        mock_extract_user_id, 
        mock_put, 
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_s3_presigned_url_response
    ):
        """Test successful file upload to S3."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_presigned_lambda.return_value = mock_s3_presigned_url_response
        mock_put.return_value = Mock(status_code=200)
        
        file_data = b'Test file content'
        key = 'pdfs/test.pdf'
        
        # Execute
        result = upload_file_to_s3(
            bucket=test_bucket,
            key=key,
            file_data=file_data,
            content_type='application/pdf',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['bucket'] == test_bucket
        assert 'users/test-user-123/pdfs/test.pdf' in result['key']
        assert result['file_name'] == 'test.pdf'
        
        # Verify user_id extraction was called
        mock_extract_user_id.assert_called_once_with(mock_jwt_token)
        
        # Verify presigned URL lambda was called
        mock_presigned_lambda.assert_called_once()
        call_args = mock_presigned_lambda.call_args
        assert call_args.kwargs['method'] == 'put'
        assert call_args.kwargs['content_type'] == 'application/pdf'
        
        # Verify PUT request was made to S3
        mock_put.assert_called_once()
        assert mock_put.call_args.args[0] == mock_s3_presigned_url_response['presigned_url']
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_upload_file_presigned_url_failure(
        self, 
        mock_extract_user_id, 
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test upload failure when presigned URL generation fails."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_presigned_lambda.return_value = {'success': False, 'message': 'Lambda error'}
        
        # Execute & Verify
        with pytest.raises(S3OperationError, match="Failed to get presigned URL"):
            upload_file_to_s3(
                bucket=test_bucket,
                key='pdfs/test.pdf',
                file_data=b'Test',
                content_type='application/pdf',
                auth_token=mock_jwt_token
            )
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.requests.put')
    @patch('utils.s3_operations.extract_user_id')
    def test_upload_file_s3_upload_failure(
        self, 
        mock_extract_user_id, 
        mock_put,
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_s3_presigned_url_response
    ):
        """Test upload failure when S3 PUT request fails."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_presigned_lambda.return_value = mock_s3_presigned_url_response
        mock_put.return_value = Mock(status_code=403)
        
        # Execute & Verify
        with pytest.raises(S3OperationError, match="S3 upload failed with status"):
            upload_file_to_s3(
                bucket=test_bucket,
                key='pdfs/test.pdf',
                file_data=b'Test',
                content_type='application/pdf',
                auth_token=mock_jwt_token
            )
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.requests.put')
    def test_upload_file_with_provided_user_id(
        self, 
        mock_put,
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_s3_presigned_url_response
    ):
        """Test upload with pre-provided user_id (skip extraction)."""
        # Setup
        mock_presigned_lambda.return_value = mock_s3_presigned_url_response
        mock_put.return_value = Mock(status_code=200)
        
        # Execute
        result = upload_file_to_s3(
            bucket=test_bucket,
            key='pdfs/test.pdf',
            file_data=b'Test',
            content_type='application/pdf',
            auth_token=mock_jwt_token,
            user_id=test_user_id  # Provide user_id directly
        )
        
        # Verify
        assert result['success'] is True


class TestListS3Objects:
    """Test list_s3_objects function."""
    
    @patch('utils.s3_operations.call_s3_list_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_list_s3_objects_folders(
        self, 
        mock_extract_user_id, 
        mock_list_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_s3_list_folders_response
    ):
        """Test listing S3 folders."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_list_lambda.return_value = mock_s3_list_folders_response
        
        # Execute
        result = list_s3_objects(
            bucket=test_bucket,
            prefix='templates',
            list_files=False,
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert 'folders' in result
        assert len(result['folders']) == 3
        assert all('template' in folder for folder in result['folders'])
        
        # Verify lambda was called with correct parameters
        mock_list_lambda.assert_called_once()
        call_args = mock_list_lambda.call_args
        assert call_args.kwargs['list_files'] is False
    
    @patch('utils.s3_operations.call_s3_list_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_list_s3_objects_files(
        self, 
        mock_extract_user_id, 
        mock_list_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_s3_list_files_response
    ):
        """Test listing S3 files."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_list_lambda.return_value = mock_s3_list_files_response
        
        # Execute
        result = list_s3_objects(
            bucket=test_bucket,
            prefix='pdfs',
            list_files=True,
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert 'files' in result
        assert len(result['files']) == 2
        assert all('file_name' in file for file in result['files'])
        assert all('size' in file for file in result['files'])
        
        # Verify lambda was called with list_files=True
        mock_list_lambda.assert_called_once()
        call_args = mock_list_lambda.call_args
        assert call_args.kwargs['list_files'] is True
    
    @patch('utils.s3_operations.call_s3_list_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_list_s3_objects_failure(
        self, 
        mock_extract_user_id, 
        mock_list_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test list failure."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_list_lambda.side_effect = ApiGatewayClientError("API Gateway error")
        
        # Execute & Verify
        with pytest.raises(S3OperationError, match="Failed to list S3 objects"):
            list_s3_objects(
                bucket=test_bucket,
                prefix='templates',
                list_files=False,
                auth_token=mock_jwt_token
            )


class TestGetPresignedUrl:
    """Test get_presigned_url function."""
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_generate_presigned_url_get(
        self, 
        mock_extract_user_id, 
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test generating presigned GET URL."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_response = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/test-bucket/test-key?signature=xyz',
            'method': 'get'
        }
        mock_presigned_lambda.return_value = mock_response
        
        # Execute
        result = get_presigned_url(
            bucket=test_bucket,
            key='pdfs/test.pdf',
            method='get',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert 'presigned_url' in result
        assert result['method'] == 'get'
        
        # Verify lambda was called with correct method
        mock_presigned_lambda.assert_called_once()
        call_args = mock_presigned_lambda.call_args
        assert call_args.kwargs['method'] == 'get'
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_generate_presigned_url_put(
        self, 
        mock_extract_user_id, 
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test generating presigned PUT URL with content type."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_response = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/test-bucket/test-key?signature=put123',
            'method': 'put'
        }
        mock_presigned_lambda.return_value = mock_response
        
        # Execute
        result = get_presigned_url(
            bucket=test_bucket,
            key='pdfs/test.pdf',
            method='put',
            auth_token=mock_jwt_token,
            content_type='application/pdf'
        )
        
        # Verify
        assert result['success'] is True
        assert result['method'] == 'put'
        
        # Verify content_type was passed
        mock_presigned_lambda.assert_called_once()
        call_args = mock_presigned_lambda.call_args
        assert call_args.kwargs['content_type'] == 'application/pdf'


class TestFetchHtmlTemplate:
    """Test fetch_html_template function."""
    
    @patch('utils.s3_operations.requests.get')
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_fetch_html_template_success(
        self, 
        mock_extract_user_id, 
        mock_presigned_lambda,
        mock_get,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_html_content
    ):
        """Test successful HTML template fetch."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_presigned_lambda.return_value = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/test-bucket/template.html?sig=abc'
        }
        mock_get.return_value = Mock(
            status_code=200,
            text=mock_html_content,
            headers={'Content-Type': 'text/html'}
        )
        
        # Execute
        result = fetch_html_template(
            bucket=test_bucket,
            template_name='test-template',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['template_name'] == 'test-template'
        assert result['html_content'] == mock_html_content
        assert 'variable1' in result['html_content']
        
        # Verify presigned URL was requested for GET
        mock_presigned_lambda.assert_called_once()
        call_args = mock_presigned_lambda.call_args
        assert call_args.kwargs['method'] == 'get'
        
        # Verify GET request to presigned URL
        mock_get.assert_called_once()
    
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_fetch_html_template_presigned_failure(
        self, 
        mock_extract_user_id, 
        mock_presigned_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test template fetch failure when presigned URL generation fails."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_presigned_lambda.return_value = {'success': False}
        
        # Execute & Verify
        with pytest.raises(S3OperationError, match="Failed to get presigned URL"):
            fetch_html_template(
                bucket=test_bucket,
                template_name='test-template',
                auth_token=mock_jwt_token
            )
    
    @patch('utils.s3_operations.requests.get')
    @patch('utils.s3_operations.call_s3_presigned_url_lambda')
    @patch('utils.s3_operations.extract_user_id')
    def test_fetch_html_template_download_failure(
        self, 
        mock_extract_user_id, 
        mock_presigned_lambda,
        mock_get,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test template fetch failure when S3 download fails."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_presigned_lambda.return_value = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/test'
        }
        mock_get.return_value = Mock(status_code=404)
        
        # Execute & Verify
        with pytest.raises(S3OperationError, match="Failed to download template"):
            fetch_html_template(
                bucket=test_bucket,
                template_name='test-template',
                auth_token=mock_jwt_token
            )
