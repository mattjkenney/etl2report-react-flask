"""
PDF Service for handling PDF text replacement operations with S3 integration.
"""

import os
import io
import requests
from typing import List, Dict, Any, Optional
from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import fitz  # PyMuPDF
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
    from utils.api_gateway_client import call_s3_presigned_url_lambda
    
    if not auth_token:
        raise Exception('Authentication token is required')
    
    try:
        # Use api_gateway_client to call Lambda function
        response = call_s3_presigned_url_lambda(
            bucket=bucket,
            key=key,
            method=s3_operation,
            auth_token=auth_token,
            content_type=content_type
        )
        
        presigned_url = response.get('presignedUrl') or response.get('presigned_url')
        
        if not presigned_url:
            raise Exception('No presigned URL returned from API Gateway')
        
        return presigned_url
    
    except Exception as e:
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


def get_font_info_from_bbox(
    pdf_content: bytes,
    page_number: int,
    bbox: Dict[str, float]
) -> Optional[Dict[str, Any]]:
    """
    Extract font information from text within a bounding box.
    
    Args:
        pdf_content: PDF content as bytes
        page_number: Page number (0-indexed)
        bbox: Bounding box with x, y, width, height
        
    Returns:
        Dictionary with font_name, font_size, is_bold, is_italic, or None if no text found
    """
    try:
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        
        if page_number >= len(doc):
            logger.warning(f"Page {page_number} out of range")
            return None
        
        page = doc[page_number]
        
        # Convert bbox to fitz rect (x0, y0, x1, y1)
        x0 = bbox.get('x', 0)
        y0 = bbox.get('y', 0)
        width = bbox.get('width', 0)
        height = bbox.get('height', 0)
        rect = fitz.Rect(x0, y0, x0 + width, y0 + height)
        
        # Extract text with formatting info
        blocks = page.get_text("dict", clip=rect)
        
        # Find the first text span in the bounding box
        for block in blocks.get("blocks", []):
            if block.get("type") == 0:  # Text block
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        font_info = {
                            'font_name': span.get('font', 'Helvetica'),
                            'font_size': span.get('size', 12),
                            'is_bold': bool(span.get('flags', 0) & 2**4),
                            'is_italic': bool(span.get('flags', 0) & 2**1),
                            'color': span.get('color', 0)
                        }
                        doc.close()
                        return font_info
        
        doc.close()
        return None
    
    except Exception as e:
        logger.error(f"Failed to extract font info: {str(e)}")
        return None


def map_font_to_reportlab(font_name: str, is_bold: bool, is_italic: bool) -> str:
    """
    Map PDF font names to ReportLab font names.
    
    Args:
        font_name: Original font name from PDF
        is_bold: Whether font is bold
        is_italic: Whether font is italic
        
    Returns:
        ReportLab-compatible font name
    """
    # Normalize font name
    font_lower = font_name.lower()
    
    # Times family
    if 'times' in font_lower:
        if is_bold and is_italic:
            return 'Times-BoldItalic'
        elif is_bold:
            return 'Times-Bold'
        elif is_italic:
            return 'Times-Italic'
        return 'Times-Roman'
    
    # Helvetica/Arial family
    elif 'helvetica' in font_lower or 'arial' in font_lower:
        if is_bold and is_italic:
            return 'Helvetica-BoldOblique'
        elif is_bold:
            return 'Helvetica-Bold'
        elif is_italic:
            return 'Helvetica-Oblique'
        return 'Helvetica'
    
    # Courier family
    elif 'courier' in font_lower:
        if is_bold and is_italic:
            return 'Courier-BoldOblique'
        elif is_bold:
            return 'Courier-Bold'
        elif is_italic:
            return 'Courier-Oblique'
        return 'Courier'
    
    # Default to Helvetica
    else:
        if is_bold and is_italic:
            return 'Helvetica-BoldOblique'
        elif is_bold:
            return 'Helvetica-Bold'
        elif is_italic:
            return 'Helvetica-Oblique'
        return 'Helvetica'


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
        replacements: List of replacement objects with x, y, width, height, text, and optional font_info
        
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
        font_info = replacement.get('font_info', {})
        
        # Convert y coordinate (PDF coordinates start from bottom)
        pdf_y = page_height - y - height
        
        # Draw white rectangle to cover existing text
        can.setFillColorRGB(1, 1, 1)
        can.rect(x, pdf_y, width, height, fill=1, stroke=0)
        
        # Draw new text
        can.setFillColorRGB(0, 0, 0)
        
        # Use detected font info if available for both font family and size
        if font_info and 'font_size' in font_info:
            font_name = map_font_to_reportlab(
                font_info.get('font_name', 'Calibri'),
                font_info.get('is_bold', False),
                font_info.get('is_italic', False)
            )
            # Use the detected font size from the original text
            font_size = font_info['font_size']
            logger.info(f"Using detected font size: {font_size}pt (bounding box height: {height})")
        else:
            # Fallback to bounding box height if no font detected
            font_name = 'Helvetica'
            font_size = height
            logger.info(f"No font detected, using bounding box height: {font_size}pt")
        
        can.setFont(font_name, font_size)
        
        # Position text at the baseline (aligned with bottom-left of text, not bounding box)
        # In PDF coordinates, text is drawn from its baseline, so we position it at pdf_y
        text_y = pdf_y
        can.drawString(x, text_y, text)
    
    can.save()
    packet.seek(0)
    return packet.read()


def replace_text_in_pdf(
    pdf_content: bytes,
    replacements: List[Dict[str, Any]],
    page_number: int = 0,
    detect_fonts: bool = True
) -> bytes:
    """
    Replace text at specified bounding boxes in a PDF.
    
    Args:
        pdf_content: Original PDF content as bytes
        replacements: List of replacement objects with x, y, width, height, and text
        page_number: Page number to apply replacements (0-indexed)
        detect_fonts: Whether to detect and match original fonts (default True)
        
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
        
        # Detect fonts if requested and not already provided
        if detect_fonts:
            for replacement in replacements:
                if 'font_info' not in replacement:
                    bbox = {
                        'x': replacement.get('x', 0),
                        'y': replacement.get('y', 0),
                        'width': replacement.get('width', 100),
                        'height': replacement.get('height', 20)
                    }
                    font_info = get_font_info_from_bbox(pdf_content, page_number, bbox)
                    if font_info:
                        replacement['font_info'] = font_info
                        logger.info(f"Detected font: {font_info['font_name']} ({font_info['font_size']}pt)")
        
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
