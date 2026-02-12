#!/usr/bin/env python3
"""
Script to create Lambda layer with correct structure.
Uses Python's zipfile module instead of the zip command.
"""

import os
import shutil
import zipfile
from pathlib import Path

# Get current directory
current_dir = Path(__file__).parent

# Paths
lambda_utils_file = current_dir / 'lambda_utils.py'
temp_dir = current_dir / 'lambda-layer'
python_dir = temp_dir / 'python'
zip_file = current_dir / 'lambda-utils-layer.zip'

# Clean up any existing temp directory or zip file
if temp_dir.exists():
    shutil.rmtree(temp_dir)
if zip_file.exists():
    zip_file.unlink()

# Create directory structure
python_dir.mkdir(parents=True, exist_ok=True)

# Copy lambda_utils.py to the python directory
shutil.copy2(lambda_utils_file, python_dir / 'lambda_utils.py')

# Create the zip file
with zipfile.ZipFile(zip_file, 'w', zipfile.ZIP_DEFLATED) as zf:
    # Add the lambda_utils.py file with the correct path structure
    zf.write(python_dir / 'lambda_utils.py', 'python/lambda_utils.py')

# Clean up temp directory
shutil.rmtree(temp_dir)

print(f"✓ Lambda layer created: {zip_file}")
print(f"✓ Size: {zip_file.stat().st_size:,} bytes")
print()
print("To deploy this layer to AWS:")
print("aws lambda publish-layer-version \\")
print("  --layer-name lambda-utils \\")
print("  --description 'Shared utilities for Lambda functions' \\")
print("  --zip-file fileb://lambda-utils-layer.zip \\")
print("  --compatible-runtimes python3.11 python3.12 \\")
print("  --region us-east-1")
print()
print("Then attach the layer to your Lambda functions and the import will work:")
print("  from lambda_utils import create_response, get_client_with_assumed_role")
