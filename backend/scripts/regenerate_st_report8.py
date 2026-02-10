import json
import os
import sys

# Ensure project root is on sys.path so we can import the backend package
SCRIPT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
sys.path.insert(0, PROJECT_ROOT)

from backend.utils.html_generator import generate_html_from_textract

ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
input_path = os.path.join(PROJECT_ROOT, 'etl2report', 'tests', 'assets', 'analyzeDocResponse.json')
output_path = os.path.join(PROJECT_ROOT, 'etl2report', 'tests', 'assets', 'st_report8.html')

# Load textract blocks (file may be either a list or dict with 'Blocks')
with open(input_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

if isinstance(data, dict) and 'Blocks' in data:
    blocks = data['Blocks']
else:
    blocks = data

html = generate_html_from_textract(textract_blocks=blocks, template_name='st_report8')

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"Wrote: {output_path}")
