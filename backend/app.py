from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os

from utils.number_formatting import (
    format_with_sig_figs,
    format_with_rounding,
)
from utils.pdf_service import process_pdf_replacement

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
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


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
