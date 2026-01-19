from flask import Flask, request, jsonify
from flask_cors import CORS
import logging

from utils.number_formatting import (
    format_with_sig_figs,
    format_with_rounding,
)

# Initialize Flask app
app = Flask(__name__)

# Configure CORS for React frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
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


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
