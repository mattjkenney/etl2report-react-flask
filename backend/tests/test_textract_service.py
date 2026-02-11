"""
Textract Service Unit Tests

Tests for textract_operations.py functions that orchestrate AWS Textract operations
via API Gateway Lambda functions.
"""

import pytest
from unittest.mock import patch, Mock, MagicMock
from utils.textract_operations import (
    start_textract_analysis,
    get_textract_results,
    poll_textract_results,
    get_textract_results_from_s3,
    TextractOperationError
)
from utils.api_gateway_client import ApiGatewayClientError


class TestStartTextractAnalysis:
    """Test start_textract_analysis function."""
    
    @patch('utils.textract_operations.call_textract_start_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_start_textract_analysis_success(
        self, 
        mock_extract_user_id, 
        mock_start_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_textract_start_response
    ):
        """Test successful Textract analysis start."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_start_lambda.return_value = mock_textract_start_response
        
        # Execute
        result = start_textract_analysis(
            bucket=test_bucket,
            key='pdfs/test.pdf',
            output_bucket=test_bucket,
            output_key_prefix='textract/results',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['job_id'] == 'test-job-abc123'
        assert result['status'] == 'IN_PROGRESS'
        assert 'output_location' in result
        
        # Verify user_id extraction
        mock_extract_user_id.assert_called_once_with(mock_jwt_token)
        
        # Verify Lambda was called with user-prefixed paths
        mock_start_lambda.assert_called_once()
        call_args = mock_start_lambda.call_args
        assert f'users/{test_user_id}' in call_args.kwargs['key']
        assert f'users/{test_user_id}' in call_args.kwargs['output_key_prefix']
    
    @patch('utils.textract_operations.call_textract_start_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_start_textract_analysis_with_user_prefix(
        self, 
        mock_extract_user_id, 
        mock_start_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token,
        mock_textract_start_response
    ):
        """Test that pre-existing user prefix is not duplicated."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_start_lambda.return_value = mock_textract_start_response
        
        # Execute with key that already has user prefix
        result = start_textract_analysis(
            bucket=test_bucket,
            key=f'users/{test_user_id}/pdfs/test.pdf',  # Already has user prefix
            output_bucket=test_bucket,
            output_key_prefix='textract/results',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        
        # Verify key was not double-prefixed
        call_args = mock_start_lambda.call_args
        key_arg = call_args.kwargs['key']
        assert key_arg.count(f'users/{test_user_id}') == 1
    
    @patch('utils.textract_operations.call_textract_start_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_start_textract_analysis_lambda_failure(
        self, 
        mock_extract_user_id, 
        mock_start_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test Textract start failure."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_start_lambda.return_value = {'success': False, 'message': 'Lambda error'}
        
        # Execute & Verify
        with pytest.raises(TextractOperationError, match="Failed to start Textract analysis"):
            start_textract_analysis(
                bucket=test_bucket,
                key='pdfs/test.pdf',
                output_bucket=test_bucket,
                output_key_prefix='textract/results',
                auth_token=mock_jwt_token
            )
    
    @patch('utils.textract_operations.call_textract_start_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_start_textract_analysis_no_job_id(
        self, 
        mock_extract_user_id, 
        mock_start_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test failure when no job_id is returned."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_start_lambda.return_value = {'success': True}  # Missing job_id
        
        # Execute & Verify
        with pytest.raises(TextractOperationError, match="No job_id returned"):
            start_textract_analysis(
                bucket=test_bucket,
                key='pdfs/test.pdf',
                output_bucket=test_bucket,
                output_key_prefix='textract/results',
                auth_token=mock_jwt_token
            )


class TestGetTextractResults:
    """Test get_textract_results function."""
    
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_get_textract_results_success(
        self, 
        mock_get_results_lambda,
        mock_jwt_token,
        mock_textract_results_success
    ):
        """Test successful retrieval of Textract results."""
        # Setup
        mock_get_results_lambda.return_value = mock_textract_results_success
        
        # Execute
        result = get_textract_results(
            job_id='test-job-abc123',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['job_status'] == 'SUCCEEDED'
        assert 'blocks' in result
        assert len(result['blocks']) == 2
        assert result['blocks'][0]['Text'] == 'Sample text line 1'
        
        # Verify Lambda was called
        mock_get_results_lambda.assert_called_once()
        call_args = mock_get_results_lambda.call_args
        assert call_args.kwargs['job_id'] == 'test-job-abc123'
    
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_get_textract_results_in_progress(
        self, 
        mock_get_results_lambda,
        mock_jwt_token,
        mock_textract_results_in_progress
    ):
        """Test retrieval when job is still in progress."""
        # Setup
        mock_get_results_lambda.return_value = mock_textract_results_in_progress
        
        # Execute
        result = get_textract_results(
            job_id='test-job-abc123',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['job_status'] == 'IN_PROGRESS'
        assert result['blocks'] == []
    
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_get_textract_results_with_pagination(
        self, 
        mock_get_results_lambda,
        mock_jwt_token
    ):
        """Test retrieval with pagination token."""
        # Setup
        paginated_response = {
            'success': True,
            'job_status': 'SUCCEEDED',
            'blocks': [{'BlockType': 'LINE', 'Text': 'More content'}],
            'next_token': 'next-page-token',
            'has_more_results': True
        }
        mock_get_results_lambda.return_value = paginated_response
        
        # Execute
        result = get_textract_results(
            job_id='test-job-abc123',
            next_token='current-page-token',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['has_more_results'] is True
        assert result['next_token'] == 'next-page-token'
        
        # Verify next_token was passed to Lambda
        call_args = mock_get_results_lambda.call_args
        assert call_args.kwargs['next_token'] == 'current-page-token'
    
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_get_textract_results_failure(
        self, 
        mock_get_results_lambda,
        mock_jwt_token
    ):
        """Test failure when Lambda call fails."""
        # Setup
        mock_get_results_lambda.side_effect = ApiGatewayClientError("API Gateway error")
        
        # Execute & Verify
        with pytest.raises(TextractOperationError, match="Failed to get Textract results"):
            get_textract_results(
                job_id='test-job-abc123',
                auth_token=mock_jwt_token
            )


class TestPollTextractResults:
    """Test poll_textract_results function."""
    
    @patch('utils.textract_operations.time.sleep')
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_poll_textract_results_immediate_success(
        self, 
        mock_get_results_lambda,
        mock_sleep,
        mock_jwt_token,
        mock_textract_results_success
    ):
        """Test polling when job completes immediately."""
        # Setup - Job is already complete
        mock_get_results_lambda.return_value = mock_textract_results_success
        
        # Execute
        result = poll_textract_results(
            job_id='test-job-abc123',
            auth_token=mock_jwt_token,
            poll_interval=1,
            max_attempts=10
        )
        
        # Verify
        assert result['success'] is True
        assert result['job_status'] == 'SUCCEEDED'
        assert len(result['blocks']) == 2
        assert result['blocks_count'] == 2
        
        # Verify Lambda was called once
        assert mock_get_results_lambda.call_count == 1
        
        # Sleep should not be called if job complete immediately
        mock_sleep.assert_not_called()
    
    @patch('utils.textract_operations.time.sleep')
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_poll_textract_results_eventual_success(
        self, 
        mock_get_results_lambda,
        mock_sleep,
        mock_jwt_token,
        mock_textract_results_in_progress,
        mock_textract_results_success
    ):
        """Test polling when job completes after a few attempts."""
        # Setup - Job in progress then succeeds
        mock_get_results_lambda.side_effect = [
            mock_textract_results_in_progress,
            mock_textract_results_in_progress,
            mock_textract_results_success
        ]
        
        # Execute
        result = poll_textract_results(
            job_id='test-job-abc123',
            auth_token=mock_jwt_token,
            poll_interval=1,
            max_attempts=10
        )
        
        # Verify
        assert result['success'] is True
        assert result['job_status'] == 'SUCCEEDED'
        
        # Verify Lambda was called 3 times
        assert mock_get_results_lambda.call_count == 3
        
        # Sleep should be called between attempts
        assert mock_sleep.call_count == 2
    
    @patch('utils.textract_operations.time.sleep')
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_poll_textract_results_with_pagination(
        self, 
        mock_get_results_lambda,
        mock_sleep,
        mock_jwt_token
    ):
        """Test polling aggregates paginated results."""
        # Setup - Job succeeds with pagination
        page1_response = {
            'success': True,
            'job_status': 'SUCCEEDED',
            'blocks': [{'BlockType': 'LINE', 'Text': 'Page 1 line 1'}],
            'next_token': 'page2-token',
            'has_more_results': True
        }
        page2_response = {
            'success': True,
            'job_status': 'SUCCEEDED',
            'blocks': [{'BlockType': 'LINE', 'Text': 'Page 2 line 1'}],
            'has_more_results': False
        }
        mock_get_results_lambda.side_effect = [page1_response, page2_response]
        
        # Execute
        result = poll_textract_results(
            job_id='test-job-abc123',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['blocks_count'] == 2
        assert len(result['blocks']) == 2
        assert result['blocks'][0]['Text'] == 'Page 1 line 1'
        assert result['blocks'][1]['Text'] == 'Page 2 line 1'
    
    @patch('utils.textract_operations.time.sleep')
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_poll_textract_results_timeout(
        self, 
        mock_get_results_lambda,
        mock_sleep,
        mock_jwt_token,
        mock_textract_results_in_progress
    ):
        """Test polling timeout when job doesn't complete."""
        # Setup - Job stays in progress
        mock_get_results_lambda.return_value = mock_textract_results_in_progress
        
        # Execute & Verify
        with pytest.raises(TextractOperationError, match="Textract polling timeout"):
            poll_textract_results(
                job_id='test-job-abc123',
                auth_token=mock_jwt_token,
                poll_interval=0.1,
                max_attempts=3
            )
        
        # Verify Lambda was called max_attempts times
        assert mock_get_results_lambda.call_count == 3
    
    @patch('utils.textract_operations.time.sleep')
    @patch('utils.textract_operations.call_textract_get_results_lambda')
    def test_poll_textract_results_job_failed(
        self, 
        mock_get_results_lambda,
        mock_sleep,
        mock_jwt_token
    ):
        """Test polling when job status is FAILED."""
        # Setup - Job failed
        failed_response = {
            'success': True,
            'job_status': 'FAILED',
            'status_message': 'Processing failed',
            'blocks': []
        }
        mock_get_results_lambda.return_value = failed_response
        
        # Execute & Verify
        with pytest.raises(TextractOperationError, match="Textract analysis failed"):
            poll_textract_results(
                job_id='test-job-abc123',
                auth_token=mock_jwt_token
            )


class TestGetTextractResultsFromS3:
    """Test get_textract_results_from_s3 function."""
    
    @patch('utils.textract_operations.requests.get')
    @patch('utils.textract_operations.call_s3_presigned_url_lambda')
    @patch('utils.textract_operations.call_s3_list_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_get_textract_results_from_s3_success(
        self, 
        mock_extract_user_id, 
        mock_list_lambda,
        mock_presigned_lambda,
        mock_get,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test successful retrieval of Textract results from S3."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        
        # Mock S3 list response
        mock_list_lambda.return_value = {
            'success': True,
            'files': [
                {'file_name': 'result1.json', 'key': f'users/{test_user_id}/textract/template1/result1.json'},
                {'file_name': 'result2.json', 'key': f'users/{test_user_id}/textract/template1/result2.json'}
            ]
        }
        
        # Mock presigned URL responses
        mock_presigned_lambda.side_effect = [
            {'success': True, 'presigned_url': 'https://s3.amazonaws.com/result1'},
            {'success': True, 'presigned_url': 'https://s3.amazonaws.com/result2'}
        ]
        
        # Mock S3 file downloads
        mock_get.side_effect = [
            Mock(status_code=200, json=lambda: {'Blocks': [{'BlockType': 'LINE', 'Text': 'Result 1'}]}),
            Mock(status_code=200, json=lambda: {'Blocks': [{'BlockType': 'LINE', 'Text': 'Result 2'}]})
        ]
        
        # Execute
        result = get_textract_results_from_s3(
            bucket=test_bucket,
            template_name='template1',
            auth_token=mock_jwt_token
        )
        
        # Verify
        assert result['success'] is True
        assert result['blocks_count'] == 2
        assert len(result['blocks']) == 2
        assert result['files_count'] == 2
        assert len(result['file_names']) == 2
        
        # Verify blocks from both files were aggregated
        assert result['blocks'][0]['Text'] == 'Result 1'
        assert result['blocks'][1]['Text'] == 'Result 2'
    
    @patch('utils.textract_operations.call_s3_list_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_get_textract_results_from_s3_no_files(
        self, 
        mock_extract_user_id, 
        mock_list_lambda,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test when no result files found in S3."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_list_lambda.return_value = {
            'success': True,
            'files': []
        }
        
        # Execute - Now returns empty results instead of raising error
        result = get_textract_results_from_s3(
            bucket=test_bucket,
            template_name='template1',
            auth_token=mock_jwt_token
        )
        
        # Verify - Should return empty results gracefully
        assert result['success'] is True
        assert result['blocks_count'] == 0
        assert result['files_count'] == 0
    
    @patch('utils.textract_operations.requests.get')
    @patch('utils.textract_operations.call_s3_presigned_url_lambda')
    @patch('utils.textract_operations.call_s3_list_lambda')
    @patch('utils.textract_operations.extract_user_id')
    def test_get_textract_results_from_s3_file_download_failure(
        self, 
        mock_extract_user_id, 
        mock_list_lambda,
        mock_presigned_lambda,
        mock_get,
        test_bucket,
        test_user_id,
        mock_jwt_token
    ):
        """Test failure when S3 file download fails."""
        # Setup
        mock_extract_user_id.return_value = test_user_id
        mock_list_lambda.return_value = {
            'success': True,
            'files': [
                {'file_name': 'result1.json', 'key': f'users/{test_user_id}/textract/template1/result1.json'}
            ]
        }
        mock_presigned_lambda.return_value = {
            'success': True,
            'presigned_url': 'https://s3.amazonaws.com/result1'
        }
        
        # Mock failed download
        mock_get.return_value = Mock(status_code=404)
        
        # Execute - Should log warning but continue
        result = get_textract_results_from_s3(
            bucket=test_bucket,
            template_name='template1',
            auth_token=mock_jwt_token
        )
        
        # Verify - Returns empty results since no files could be downloaded
        assert result['blocks_count'] == 0
        assert result['files_count'] == 0
