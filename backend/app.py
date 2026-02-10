from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from utils.number_formatting import (
    format_with_sig_figs,
    format_with_rounding,
)
from utils.pdf_service import process_pdf_replacement
from utils.html_generator import generate_html_from_textract

# Initialize Flask app
app = Flask(__name__)

# Get allowed frontend origins from environment variable
# For development: use localhost URLs
# For production: use your deployed frontend URL (comma-separated for multiple origins)
frontend_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173').split(',')

# Configure CORS for React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": frontend_origins,
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": [
            "Content-Type",
            "Authorization",
            "application/json",
            "multipart/form-data",
            "text/plain"
        ],
        "supports_credentials": True,
        "expose_headers": ["Content-Type"]
    }
})

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Number Formatting Endpoints
@app.route('/api/format/sig-figs', methods=['POST'])
def format_significant_figures():
    """
    Format a number with significant figures
    
    Request body:
    {
        "value": 123.456,
        "sigFigs": 3
    }
    """
    try:
        data = request.get_json()
        value = data.get('value')
        sig_figs = data.get('sigFigs')
        
        if value is None or sig_figs is None:
            return jsonify({'error': 'Missing required fields: value, sigFigs'}), 400
        
        result = format_with_sig_figs(value, sig_figs)
        
        return jsonify({
            'original': value,
            'formatted': result,
            'sigFigs': sig_figs
        }), 200
    
    except Exception as e:
        logger.error(f"Error in format_significant_figures: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/format/rounding', methods=['POST'])
def format_rounding():
    """
    Format a number with decimal place rounding
    
    Request body:
    {
        "value": 123.456789,
        "decimalPlaces": 2
    }
    """
    try:
        data = request.get_json()
        value = data.get('value')
        decimal_places = data.get('decimalPlaces')
        
        if value is None or decimal_places is None:
            return jsonify({'error': 'Missing required fields: value, decimalPlaces'}), 400
        
        result = format_with_rounding(value, decimal_places)
        
        return jsonify({
            'original': value,
            'formatted': result,
            'decimalPlaces': decimal_places
        }), 200
    
    except Exception as e:
        logger.error(f"Error in format_rounding: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/pdf/replace-text', methods=['POST'])
def replace_pdf_text():
    """
    Replace text at specified bounding boxes in a PDF template.
    
    Request body:
    {
        "template_id": "template name.pdf",
        "replacements": [
            {
                "x": 123,
                "y": 123,
                "height": 5,
                "width": 5,
                "text": "my replacement text"
            }
        ],
        "page_number": 0,  // Optional, defaults to 0 (first page)
        "source_bucket": "my-bucket",  // Optional, defaults to env var
        "destination_bucket": "my-bucket",  // Optional, defaults to source bucket
        "output_key": "output/modified.pdf"  // Optional, defaults to modified_{template_id}
    }
    
    Headers:
        Authorization: Bearer <JWT token>
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        
        auth_token = auth_header.replace('Bearer ', '')
        
        data = request.get_json()
        
        # Extract required parameters
        template_id = data.get('template_id')
        replacements = data.get('replacements', [])
        
        # Validate required fields
        if not template_id:
            return jsonify({'error': 'Missing required field: template_id'}), 400
        
        if not isinstance(replacements, list) or len(replacements) == 0:
            return jsonify({'error': 'replacements must be a non-empty list'}), 400
        
        # Validate each replacement object
        for idx, replacement in enumerate(replacements):
            required_fields = ['x', 'y', 'height', 'width', 'text']
            for field in required_fields:
                if field not in replacement:
                    return jsonify({
                        'error': f'Missing required field "{field}" in replacement at index {idx}'
                    }), 400
        
        # Extract optional parameters
        page_number = data.get('page_number', 0)
        source_bucket = data.get('source_bucket') or os.getenv('S3_BUCKET')
        destination_bucket = data.get('destination_bucket') or source_bucket
        
        # Generate output key if not provided
        output_key = data.get('output_key')
        if not output_key:
            # Extract filename without extension and add modified_ prefix
            template_name = template_id.rsplit('.', 1)[0]
            output_key = f"modified_{template_name}.pdf"
        
        # Validate bucket configuration
        if not source_bucket:
            return jsonify({
                'error': 'S3 bucket not configured. Set S3_BUCKET environment variable or provide source_bucket in request'
            }), 500
        
        # Process the PDF replacement
        result = process_pdf_replacement(
            source_bucket=source_bucket,
            source_key=template_id,
            destination_bucket=destination_bucket,
            destination_key=output_key,
            replacements=replacements,
            auth_token=auth_token,
            page_number=page_number
        )
        
        # Return response based on success
        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 500
    
    except Exception as e:
        logger.error(f"Error in replace_pdf_text: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to process PDF text replacement'
        }), 500


@app.route('/api/pdf/convert-to-html', methods=['POST'])
def convert_pdf_to_html():
    """
    Convert PDF layout to HTML template using Textract blocks.
    
    Request body:
    {
        "template_name": "My Template",
        "textract_blocks": [...],  // Array of Textract block objects
        "page_width": 612,  // Optional, defaults to US Letter width
        "page_height": 792,  // Optional, defaults to US Letter height
        "pdf_s3_bucket": "bucket-name",  // Optional, for font detection
        "pdf_s3_key": "path/to/file.pdf"  // Optional, for font detection
    }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "html": "<html>...</html>",
            "template_name": "My Template",
            "block_count": 123,
            "font_detection_enabled": true
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401
        
        data = request.get_json()
        
        # Extract required parameters
        template_name = data.get('template_name')
        textract_blocks = data.get('textract_blocks', [])
        
        # Validate required fields
        if not template_name:
            return jsonify({'error': 'Missing required field: template_name'}), 400
        
        if not isinstance(textract_blocks, list):
            return jsonify({'error': 'textract_blocks must be a list'}), 400
        
        # Extract optional parameters
        page_width = data.get('page_width', 612)
        page_height = data.get('page_height', 792)
        pdf_s3_bucket = data.get('pdf_s3_bucket')
        pdf_s3_key = data.get('pdf_s3_key')
        
        # Download PDF for font detection if S3 location provided
        pdf_content = None
        font_detection_enabled = False
        
        if pdf_s3_bucket and pdf_s3_key:
            try:
                from utils.pdf_service import download_pdf_from_s3
                auth_token = auth_header.replace('Bearer ', '')
                pdf_content = download_pdf_from_s3(pdf_s3_bucket, pdf_s3_key, auth_token)
                font_detection_enabled = True
                logger.info(f"PDF downloaded for font detection: {pdf_s3_bucket}/{pdf_s3_key}")
            except Exception as e:
                logger.warning(f"Failed to download PDF for font detection: {str(e)}")
                # Continue without font detection
        
        # Generate HTML from Textract blocks
        html_content = generate_html_from_textract(
            textract_blocks=textract_blocks,
            template_name=template_name,
            page_width=page_width,
            page_height=page_height,
            pdf_content=pdf_content
        )
        
        # Count text blocks in generated HTML
        line_blocks = [b for b in textract_blocks if b.get('BlockType') == 'LINE']
        
        return jsonify({
            'success': True,
            'html': html_content,
            'template_name': template_name,
            'block_count': len(line_blocks),
            'page_dimensions': {
                'width': page_width,
                'height': page_height
            },
            'font_detection_enabled': font_detection_enabled
        }), 200
    
    except Exception as e:
        logger.error(f"Error in convert_pdf_to_html: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'message': 'Failed to convert PDF to HTML template'
        }), 500


# HTML-based report generation endpoint
from utils.html_service import fetch_html_template_from_s3, replace_html_elements_by_block_id, convert_html_to_pdf_playwright
import asyncio

# Import new proxy operation modules
from utils.s3_operations import (
    upload_file_to_s3,
    list_s3_objects,
    get_presigned_url,
    fetch_html_template,
    S3OperationError
)
from utils.textract_operations import (
    start_textract_analysis,
    get_textract_results,
    poll_textract_results,
    get_textract_results_from_s3,
    TextractOperationError
)
from utils.jwt_helper import extract_token_from_header


# ==========================================
# S3 PROXY ENDPOINTS
# ==========================================

@app.route('/api/s3/upload', methods=['POST'])
def s3_upload():
    """
    Upload file to S3.
    
    Request body (multipart/form-data):
        - file: File to upload
        - bucket: S3 bucket name (optional, uses env default)
        - key: S3 object key (will be prefixed with users/{user_id}/)
        - description: File description (optional)
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "message": "File uploaded successfully",
            "bucket": "my-bucket",
            "key": "users/user123/file.pdf",
            "file_name": "file.pdf",
            "size": 12345
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        # Get file from request
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'Empty filename'}), 400
        
        # Get parameters from form data
        bucket = request.form.get('bucket') or os.getenv('S3_BUCKET')
        key = request.form.get('key') or file.filename
        description = request.form.get('description')
        content_type = file.content_type or 'application/octet-stream'
        
        if not bucket:
            return jsonify({'error': 'S3 bucket not configured'}), 500
        
        # Read file data
        file_data = file.read()
        
        # Upload to S3
        result = upload_file_to_s3(
            bucket=bucket,
            key=key,
            file_data=file_data,
            content_type=content_type,
            auth_token=auth_token,
            description=description
        )
        
        return jsonify(result), 200
        
    except S3OperationError as e:
        logger.error(f"S3 upload error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in s3_upload: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/s3/list-objects', methods=['POST'])
def s3_list_objects():
    """
    List folders or files in S3 bucket.
    
    Request body:
        {
            "bucket": "my-bucket",
            "parent_folder": "templates/",  // Optional, will be prefixed with users/{user_id}/
            "list_files": false  // true for files, false for folders
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "folders": ["templates/", "reports/"]  // or "files": [...]
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        bucket = data.get('bucket') or os.getenv('S3_BUCKET')
        parent_folder = data.get('parent_folder', '')
        list_files = data.get('list_files', False)
        
        if not bucket:
            return jsonify({'error': 'S3 bucket not configured'}), 500
        
        # List objects
        result = list_s3_objects(
            bucket=bucket,
            prefix=parent_folder,
            list_files=list_files,
            auth_token=auth_token
        )
        
        return jsonify(result), 200
        
    except S3OperationError as e:
        logger.error(f"S3 list error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in s3_list_objects: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/s3/presigned-url', methods=['POST'])
def s3_presigned_url():
    """
    Generate presigned URL for S3 operations.
    
    Request body:
        {
            "bucket": "my-bucket",
            "key": "file.pdf",  // Will be prefixed with users/{user_id}/
            "method": "get",  // "get" or "put"
            "content_type": "application/pdf",  // Optional, for put
            "expiration": 3600  // Optional, seconds
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "presigned_url": "https://s3.amazonaws.com/...",
            "bucket": "my-bucket",
            "key": "users/user123/file.pdf",
            "method": "get",
            "expires_in": 3600
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        bucket = data.get('bucket') or os.getenv('S3_BUCKET')
        key = data.get('key')
        method = data.get('method', 'get')
        content_type = data.get('content_type')
        expiration = data.get('expiration', 3600)
        
        if not bucket or not key:
            return jsonify({'error': 'Missing required fields: bucket, key'}), 400
        
        # Get presigned URL
        result = get_presigned_url(
            bucket=bucket,
            key=key,
            method=method,
            auth_token=auth_token,
            content_type=content_type,
            expiration=expiration
        )
        
        return jsonify(result), 200
        
    except S3OperationError as e:
        logger.error(f"S3 presigned URL error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in s3_presigned_url: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/s3/fetch-html-template', methods=['POST'])
def s3_fetch_html_template():
    """
    Fetch HTML template from S3.
    
    Request body:
        {
            "template_name": "template1.html",
            "bucket": "my-bucket"  // Optional, uses env default
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "html_content": "<html>...</html>",
            "template_name": "template1.html",
            "size": 12345
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        template_name = data.get('template_name')
        bucket = data.get('bucket') or os.getenv('S3_BUCKET')
        
        if not template_name:
            return jsonify({'error': 'Missing required field: template_name'}), 400
        
        if not bucket:
            return jsonify({'error': 'S3 bucket not configured'}), 500
        
        # Fetch template
        result = fetch_html_template(
            bucket=bucket,
            template_name=template_name,
            auth_token=auth_token
        )
        
        return jsonify(result), 200
        
    except S3OperationError as e:
        logger.error(f"Fetch template error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in s3_fetch_html_template: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


# ==========================================
# TEXTRACT PROXY ENDPOINTS
# ==========================================

@app.route('/api/textract/start-analysis', methods=['POST'])
def textract_start_analysis():
    """
    Start Textract document analysis.
    
    Request body:
        {
            "bucket": "my-bucket",
            "key": "file.pdf",  // Will be prefixed with users/{user_id}/
            "output_bucket": "my-bucket",  // Optional, defaults to bucket
            "output_key_prefix": "textract/"  // Optional, will be prefixed with users/{user_id}/
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "job_id": "abc123...",
            "status": "IN_PROGRESS",
            "output_location": "s3://bucket/prefix/"
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        bucket = data.get('bucket') or os.getenv('S3_BUCKET')
        key = data.get('key')
        output_bucket = data.get('output_bucket') or bucket
        output_key_prefix = data.get('output_key_prefix', 'textract/')
        
        if not bucket or not key:
            return jsonify({'error': 'Missing required fields: bucket, key'}), 400
        
        # Start Textract analysis
        result = start_textract_analysis(
            bucket=bucket,
            key=key,
            output_bucket=output_bucket,
            output_key_prefix=output_key_prefix,
            auth_token=auth_token
        )
        
        return jsonify(result), 200
        
    except TextractOperationError as e:
        logger.error(f"Textract start error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in textract_start_analysis: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/textract/get-results', methods=['POST'])
def textract_get_results():
    """
    Get Textract analysis results (single call).
    
    Request body:
        {
            "job_id": "abc123...",
            "next_token": "..."  // Optional, for pagination
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "job_status": "SUCCEEDED",
            "status_message": "Analysis completed",
            "blocks": [...],
            "document_metadata": {...},
            "next_token": "...",  // Optional
            "has_more_results": false
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        job_id = data.get('job_id')
        next_token = data.get('next_token')
        
        if not job_id:
            return jsonify({'error': 'Missing required field: job_id'}), 400
        
        # Get results
        result = get_textract_results(
            job_id=job_id,
            auth_token=auth_token,
            next_token=next_token
        )
        
        return jsonify(result), 200
        
    except TextractOperationError as e:
        logger.error(f"Textract get results error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in textract_get_results: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/textract/poll-results', methods=['POST'])
def textract_poll_results():
    """
    Poll Textract results until completion (server-side polling).
    
    Request body:
        {
            "job_id": "abc123...",
            "poll_interval": 5,  // Optional, seconds (default 5)
            "max_attempts": 60  // Optional, (default 60)
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "job_status": "SUCCEEDED",
            "blocks": [...],  // All paginated results combined
            "blocks_count": 1234,
            "document_metadata": {...},
            "polling_stats": {
                "attempts": 12,
                "duration_seconds": 60
            }
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        job_id = data.get('job_id')
        poll_interval = data.get('poll_interval', 5)
        max_attempts = data.get('max_attempts', 60)
        
        if not job_id:
            return jsonify({'error': 'Missing required field: job_id'}), 400
        
        # Poll results (server-side)
        result = poll_textract_results(
            job_id=job_id,
            auth_token=auth_token,
            poll_interval=poll_interval,
            max_attempts=max_attempts
        )
        
        return jsonify(result), 200
        
    except TextractOperationError as e:
        logger.error(f"Textract poll error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in textract_poll_results: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/textract/get-results-from-s3', methods=['POST'])
def textract_get_results_from_s3():
    """
    Fetch all Textract results from S3 for a template.
    
    Request body:
        {
            "bucket": "my-bucket",
            "template_name": "template1"
        }
    
    Headers:
        Authorization: Bearer <JWT token>
    
    Returns:
        {
            "success": true,
            "blocks": [...],  // Combined from all result files
            "blocks_count": 5678,
            "files_count": 3,
            "file_names": ["result1.json", "result2.json"]
        }
    """
    try:
        # Extract and validate auth token
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Missing Authorization header'}), 401
        
        auth_token = extract_token_from_header(auth_header)
        
        data = request.get_json()
        
        bucket = data.get('bucket') or os.getenv('S3_BUCKET')
        template_name = data.get('template_name')
        
        if not template_name:
            return jsonify({'error': 'Missing required field: template_name'}), 400
        
        if not bucket:
            return jsonify({'error': 'S3 bucket not configured'}), 500
        
        # Get results from S3
        result = get_textract_results_from_s3(
            bucket=bucket,
            template_name=template_name,
            auth_token=auth_token
        )
        
        return jsonify(result), 200
        
    except TextractOperationError as e:
        logger.error(f"Textract S3 fetch error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500
    except Exception as e:
        logger.error(f"Unexpected error in textract_get_results_from_s3: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/report/generate-from-html', methods=['POST', 'OPTIONS'])
def generate_report_from_html():
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        return '', 200
    """
    Generate a report by fetching an HTML template from S3, replacing elements by data-block-id, converting to PDF, and uploading to S3.
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing authorization'}), 401

        auth_token = auth_header.replace('Bearer ', '')
        data = request.get_json()

        template_id = data.get('template_id')
        replacements = data.get('replacements', {})
        output_key = data.get('output_key')
        bucket = data.get('bucket') or os.getenv('S3_BUCKET')

        if not template_id or not output_key or not bucket:
            return jsonify({'success': False, 'error': 'Missing required fields: template_id, output_key, bucket'}), 400

        # Step 1: Fetch HTML template
        html_content = fetch_html_template_from_s3(bucket, template_id, auth_token)

        # Step 2: Replace elements by data-block-id
        modified_html = replace_html_elements_by_block_id(html_content, replacements)

        # Step 3: Convert to PDF
        pdf_bytes = asyncio.run(convert_html_to_pdf_playwright(modified_html))

        # Step 4: Upload PDF to S3
        from utils.pdf_service import upload_pdf_to_s3
        upload_pdf_to_s3(bucket, output_key, pdf_bytes, auth_token)

        return jsonify({
            'success': True,
            'destination': output_key,
            'message': 'Report generated successfully'
        }), 200

    except Exception as e:
        logger.error(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': str(e), 'message': 'Failed to generate report from HTML'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
