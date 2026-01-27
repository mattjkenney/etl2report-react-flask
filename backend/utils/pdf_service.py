"""
PDF Service for handling PDF text replacement operations with S3 integration.
"""

import os
import io
import requests
from typing import List, Dict, Any
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
import logging

logger = logging.getLogger(__name__)


def get_s3_presigned_url(
    bucket: str,
    key: str,
    s3_operation: str = 'get',
    content_type: str = None,
    auth_token: str = None
) -> str:
    """
    Get a presigned URL from API Gateway Lambda function.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        s3_operation: S3 operation type - 'get' or 'put'
        content_type: MIME type (required for PUT operations)
        auth_token: JWT authentication token from frontend
        
    Returns:
        Presigned URL string
    """
    # Get API Gateway endpoint from environment
    api_endpoint = os.getenv('S3_PRESIGNED_URL_API_ENDPOINT')
    if not api_endpoint:
        raise Exception('S3_PRESIGNED_URL_API_ENDPOINT not configured in environment')
    
    if not auth_token:
        raise Exception('Authentication token is required')
    
    # Prepare request body for Lambda
    request_body = {
        'bucket': bucket,
        'key': key,
        'method': s3_operation  # 'get' or 'put' for S3 operation
    }
    
    if s3_operation == 'put' and content_type:
        request_body['contentType'] = content_type
    
    # Call API Gateway with POST method
    headers = {
        'Authorization': f'Bearer {auth_token}',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.post(api_endpoint, json=request_body, headers=headers)
        response.raise_for_status()
        
        data = response.json()
        presigned_url = data.get('presignedUrl')
        
        if not presigned_url:
            raise Exception('No presigned URL returned from API Gateway')
        
        return presigned_url
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to get presigned URL from API Gateway: {str(e)}")
        raise Exception(f"Failed to get presigned URL: {str(e)}")


def download_pdf_from_s3(bucket: str, key: str, auth_token: str) -> bytes:
    """
    Download a PDF from S3 using a presigned URL.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        auth_token: JWT authentication token from frontend
        
    Returns:
        PDF content as bytes
    """
    try:
        presigned_url = get_s3_presigned_url(bucket, key, s3_operation='get', auth_token=auth_token)
        
        response = requests.get(presigned_url)
        response.raise_for_status()
        
        return response.content
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to download PDF from S3: {str(e)}")
        raise Exception(f"Failed to download PDF: {str(e)}")


def upload_pdf_to_s3(bucket: str, key: str, pdf_content: bytes, auth_token: str) -> str:
    """
    Upload a PDF to S3 using a presigned URL.
    
    Args:
        bucket: S3 bucket name
        key: S3 object key
        pdf_content: PDF content as bytes
        auth_token: JWT authentication token from frontend
        
    Returns:
        S3 object key where the PDF was uploaded
    """
    try:
        presigned_url = get_s3_presigned_url(
            bucket, key, s3_operation='put', content_type='application/pdf', auth_token=auth_token
        )
        
        headers = {
            'Content-Type': 'application/pdf'
        }
        
        response = requests.put(presigned_url, data=pdf_content, headers=headers)
        response.raise_for_status()
        
        return key
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Failed to upload PDF to S3: {str(e)}")
        raise Exception(f"Failed to upload PDF: {str(e)}")


def create_overlay_with_text(
    page_width: float,
    page_height: float,
    replacements: List[Dict[str, Any]]
) -> bytes:
    """
    Create a PDF overlay with text at specified bounding box positions.
    
    Args:
        page_width: Width of the page in points
        page_height: Height of the page in points
        replacements: List of replacement objects with x, y, width, height, and text
        
    Returns:
        PDF overlay content as bytes
    """
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=(page_width, page_height))
    
    for replacement in replacements:
        x = replacement.get('x', 0)
        y = replacement.get('y', 0)
        width = replacement.get('width', 100)
        height = replacement.get('height', 20)
        text = replacement.get('text', '')
        
        # Convert y coordinate (PDF coordinates start from bottom)
        pdf_y = page_height - y - height
        
        # Draw white rectangle to cover existing text
        can.setFillColorRGB(1, 1, 1)
        can.rect(x, pdf_y, width, height, fill=1, stroke=0)
        
        # Draw new text
        can.setFillColorRGB(0, 0, 0)
        
        # Calculate appropriate font size based on height
        font_size = min(height * 0.7, 12)  # Max 12pt font
        can.setFont("Helvetica", font_size)
        
        # Position text in the middle of the bounding box
        text_y = pdf_y + (height - font_size) / 2
        can.drawString(x + 2, text_y, text)
    
    can.save()
    packet.seek(0)
    return packet.read()


def replace_text_in_pdf(
    pdf_content: bytes,
    replacements: List[Dict[str, Any]],
    page_number: int = 0
) -> bytes:
    """
    Replace text at specified bounding boxes in a PDF.
    
    Args:
        pdf_content: Original PDF content as bytes
        replacements: List of replacement objects with x, y, width, height, and text
        page_number: Page number to apply replacements (0-indexed)
        
    Returns:
        Modified PDF content as bytes
    """
    try:
        # Read the original PDF
        pdf_reader = PdfReader(io.BytesIO(pdf_content))
        pdf_writer = PdfWriter()
        
        # Get the target page
        if page_number >= len(pdf_reader.pages):
            raise ValueError(f"Page number {page_number} out of range. PDF has {len(pdf_reader.pages)} pages.")
        
        page = pdf_reader.pages[page_number]
        
        # Get page dimensions
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)
        
        # Create overlay with replacement text
        overlay_content = create_overlay_with_text(page_width, page_height, replacements)
        overlay_pdf = PdfReader(io.BytesIO(overlay_content))
        
        # Merge overlay with original page
        page.merge_page(overlay_pdf.pages[0])
        
        # Add all pages to the writer
        for i, pg in enumerate(pdf_reader.pages):
            if i == page_number:
                pdf_writer.add_page(page)
            else:
                pdf_writer.add_page(pg)
        
        # Write to output
        output = io.BytesIO()
        pdf_writer.write(output)
        output.seek(0)
        
        return output.read()
    
    except Exception as e:
        logger.error(f"Failed to replace text in PDF: {str(e)}")
        raise Exception(f"Failed to replace text in PDF: {str(e)}")


def process_pdf_replacement(
    source_bucket: str,
    source_key: str,
    destination_bucket: str,
    destination_key: str,
    replacements: List[Dict[str, Any]],
    auth_token: str,
    page_number: int = 0
) -> Dict[str, Any]:
    """
    Complete workflow to download PDF, replace text, and upload modified PDF.
    
    Args:
        source_bucket: Source S3 bucket name
        source_key: Source S3 object key
        destination_bucket: Destination S3 bucket name
        destination_key: Destination S3 object key
        replacements: List of replacement objects with x, y, width, height, and text
        auth_token: JWT authentication token from frontend
        page_number: Page number to apply replacements (0-indexed)
        
    Returns:
        Dictionary with success status and details
    """
    try:
        # Download source PDF
        logger.info(f"Downloading PDF from s3://{source_bucket}/{source_key}")
        pdf_content = download_pdf_from_s3(source_bucket, source_key, auth_token)
        
        # Replace text
        logger.info(f"Replacing text in {len(replacements)} locations on page {page_number}")
        modified_pdf = replace_text_in_pdf(pdf_content, replacements, page_number)
        
        # Upload modified PDF
        logger.info(f"Uploading modified PDF to s3://{destination_bucket}/{destination_key}")
        upload_key = upload_pdf_to_s3(destination_bucket, destination_key, modified_pdf, auth_token)
        
        return {
            'success': True,
            'message': 'PDF text replacement completed successfully',
            'source': f"s3://{source_bucket}/{source_key}",
            'destination': f"s3://{destination_bucket}/{upload_key}",
            'replacements_count': len(replacements)
        }
    
    except Exception as e:
        logger.error(f"PDF replacement process failed: {str(e)}")
        return {
            'success': False,
            'message': f'PDF replacement failed: {str(e)}',
            'error': str(e)
        }
