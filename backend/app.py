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

# Configure CORS for React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
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
