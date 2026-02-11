# Backend Test Suite

This directory contains comprehensive tests for the ETL2Report backend API.

## Test Structure

```
tests/
├── conftest.py                    # Shared fixtures and configuration
├── test_s3_service.py            # S3 operations unit tests
├── test_textract_service.py      # Textract operations unit tests
└── test_api_endpoints.py         # API endpoint integration tests
```

## Test Categories

### Unit Tests

#### S3 Service Tests (`test_s3_service.py`)
Tests for S3 operations that proxy to API Gateway Lambda functions:
- `upload_file_to_s3()` - File upload with presigned URLs
- `list_s3_objects()` - List folders and files
- `get_presigned_url()` - Generate presigned URLs (GET/PUT)
- `fetch_html_template()` - Fetch HTML templates from S3

#### Textract Service Tests (`test_textract_service.py`)
Tests for Textract operations that proxy to API Gateway Lambda functions:
- `start_textract_analysis()` - Start document analysis jobs
- `get_textract_results()` - Retrieve single-page results
- `poll_textract_results()` - Server-side polling for completion
- `get_textract_results_from_s3()` - Fetch aggregated results from S3

### Integration Tests

#### API Endpoint Tests (`test_api_endpoints.py`)
Tests for Flask API endpoints with full request/response flow:

**S3 Endpoints:**
- `POST /api/s3/upload` - File upload
- `POST /api/s3/list-objects` - List folders/files
- `POST /api/s3/presigned-url` - Generate presigned URLs
- `POST /api/s3/fetch-html-template` - Fetch HTML templates

**Textract Endpoints:**
- `POST /api/textract/start-analysis` - Start analysis
- `POST /api/textract/get-results` - Get results (single call)
- `POST /api/textract/poll-results` - Poll for completion
- `POST /api/textract/get-results-from-s3` - Get results from S3

**Security Tests:**
- Authentication enforcement on all endpoints
- User data isolation verification

## Running Tests

### Install Test Dependencies

```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

### Run All Tests

```bash
pytest
```

### Run Specific Test Files

```bash
# S3 service tests only
pytest tests/test_s3_service.py

# Textract service tests only
pytest tests/test_textract_service.py

# API endpoint tests only
pytest tests/test_api_endpoints.py
```

### Run Specific Test Classes

```bash
# Test S3 upload functionality
pytest tests/test_s3_service.py::TestUploadFileToS3

# Test Textract polling
pytest tests/test_textract_service.py::TestPollTextractResults

# Test authentication enforcement
pytest tests/test_api_endpoints.py::TestAuthenticationRequired
```

### Run with Coverage Report

```bash
# Generate coverage report
pytest --cov=utils --cov=app --cov-report=html

# View coverage report
open htmlcov/index.html
```

### Run with Verbose Output

```bash
pytest -v
```

### Run with Print Statements

```bash
pytest -s
```

## Test Fixtures

### Shared Fixtures (defined in `conftest.py`)

#### Authentication
- `mock_jwt_token` - Valid JWT token for testing
- `test_user_id` - Standard test user ID
- `auth_header` - Authorization header with Bearer token

#### AWS Resources
- `test_bucket` - Standard test S3 bucket name

#### Mock Responses
- `mock_s3_presigned_url_response` - S3 presigned URL Lambda response
- `mock_s3_list_folders_response` - S3 list folders Lambda response
- `mock_s3_list_files_response` - S3 list files Lambda response
- `mock_textract_start_response` - Textract start Lambda response
- `mock_textract_results_in_progress` - Textract in-progress response
- `mock_textract_results_success` - Textract completed response
- `mock_html_content` - Sample HTML template content

#### Flask Client
- `app_client` - Flask test client for integration tests

## Writing New Tests

### Unit Test Example

```python
@patch('utils.s3_operations.call_s3_presigned_url_lambda')
@patch('utils.s3_operations.extract_user_id')
def test_new_s3_function(
    mock_extract_user_id, 
    mock_lambda,
    test_bucket,
    test_user_id,
    mock_jwt_token
):
    # Setup
    mock_extract_user_id.return_value = test_user_id
    mock_lambda.return_value = {'success': True}
    
    # Execute
    result = my_new_function(bucket=test_bucket, auth_token=mock_jwt_token)
    
    # Verify
    assert result['success'] is True
    mock_lambda.assert_called_once()
```

### Integration Test Example

```python
@patch('app.my_service_function')
def test_new_endpoint(mock_service, app_client, auth_header):
    # Setup
    mock_service.return_value = {'success': True, 'data': 'test'}
    
    # Execute
    response = app_client.post(
        '/api/my-endpoint',
        json={'param': 'value'},
        headers=auth_header
    )
    
    # Verify
    assert response.status_code == 200
    result = response.get_json()
    assert result['success'] is True
```

## Test Coverage Goals

- **Unit Tests**: 90%+ coverage of service functions
- **Integration Tests**: 100% coverage of API endpoints
- **Edge Cases**: Test error handling, missing parameters, invalid auth
- **User Isolation**: Verify user data access controls

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Backend Tests
  run: |
    cd backend
    source .venv/bin/activate
    pytest --cov --cov-report=xml
```

## Troubleshooting

### Import Errors
Make sure you're running tests from the backend directory:
```bash
cd backend
pytest
```

### Fixture Not Found
Check that `conftest.py` is in the tests directory and pytest can discover it.

### Mock Not Working
Verify the patch path matches the module where the function is used, not where it's defined:
```python
# If app.py does: from utils.s3_operations import upload_file_to_s3
# Then patch: @patch('app.upload_file_to_s3')
# NOT: @patch('utils.s3_operations.upload_file_to_s3')
```

## Next Steps

After running tests:
1. Review coverage report to identify gaps
2. Add tests for edge cases
3. Update tests when adding new features
4. Run tests before committing code
5. Integrate tests into CI/CD pipeline
