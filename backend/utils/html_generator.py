"""
HTML Template Generator - Creates HTML templates from PDF layout data.

This module converts PDF Textract analysis results into structured HTML templates
that can be manipulated and later rendered back to PDF using Playwright.

LAYOUT_FIGURE blocks are rendered as bordered placeholders. Text blocks that fall
within figure boundaries are ignored. The application will replace figure placeholders
with actual images or graphs at runtime.
"""

import logging
import math
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def generate_html_from_textract(
    textract_blocks: List[Dict[str, Any]],
    template_name: str,
    page_width: float = 612,  # 8.5 inches at 72 DPI
    page_height: float = 792,   # 11 inches at 72 DPI
    pdf_content: Optional[bytes] = None  # Optional PDF content for font detection
) -> str:
    """
    Generate an HTML template from Textract blocks.
    
    Args:
        textract_blocks: List of Textract block dictionaries containing text and bounding boxes
        template_name: Name of the template for metadata
        page_width: PDF page width in points (default: US Letter)
        page_height: PDF page height in points (default: US Letter)
        pdf_content: Optional PDF content as bytes for font detection
        
    Returns:
        HTML string with absolute positioned elements matching PDF layout
    """
    # Filter for LAYOUT_FIGURE blocks (images/graphs to render as placeholders)
    figure_blocks = [
        block for block in textract_blocks 
        if block.get('BlockType') == 'LAYOUT_FIGURE'
    ]
    
    # Filter for LINE blocks (contain text with accurate positioning)
    line_blocks = [
        block for block in textract_blocks 
        if block.get('BlockType') == 'LINE' and block.get('Text')
    ]
    
    if not line_blocks and not figure_blocks:
        logger.warning("No LINE or LAYOUT_FIGURE blocks found in Textract data")
        return _generate_empty_template(template_name, page_width, page_height)
    
    logger.info(f"Found {len(figure_blocks)} figure blocks and {len(line_blocks)} line blocks")
    
    logger.info(f"Found {len(figure_blocks)} figure blocks and {len(line_blocks)} line blocks")
    
    # Helper function to check if a bounding box is inside a figure
    def is_inside_figure(bbox: Dict[str, float], page_num: int, figures: List[tuple]) -> bool:
        """Check if a bounding box overlaps with any figure on the same page."""
        left = bbox.get('Left', 0)
        top = bbox.get('Top', 0)
        width = bbox.get('Width', 0)
        height = bbox.get('Height', 0)
        right = left + width
        bottom = top + height
        
        for fig_page, fig_bbox in figures:
            if fig_page != page_num:
                continue
                
            fig_left = fig_bbox.get('Left', 0)
            fig_top = fig_bbox.get('Top', 0)
            fig_width = fig_bbox.get('Width', 0)
            fig_height = fig_bbox.get('Height', 0)
            fig_right = fig_left + fig_width
            fig_bottom = fig_top + fig_height
            
            # Check if bounding boxes overlap
            if not (right < fig_left or left > fig_right or bottom < fig_top or top > fig_bottom):
                return True
                
        return False
    
    # Build list of figure bounding boxes by page for quick lookup
    figures_by_page = []
    for block in figure_blocks:
        page_num = block.get('Page', 1)
        geometry = block.get('Geometry', {})
        bbox = geometry.get('BoundingBox', {})
        if bbox:
            figures_by_page.append((page_num, bbox))
    
    # Group blocks by page number
    pages_dict = {}
    for block in line_blocks:
        page_num = block.get('Page', 1)
        geometry = block.get('Geometry', {})
        bbox = geometry.get('BoundingBox', {})
        
        # Skip text blocks that are inside figure blocks
        if bbox and is_inside_figure(bbox, page_num, figures_by_page):
            logger.debug(f"Skipping text block inside figure: '{block.get('Text', '')[:30]}...'")
            continue
            
        if page_num not in pages_dict:
            pages_dict[page_num] = {'lines': [], 'figures': []}
        pages_dict[page_num]['lines'].append(block)
    
    # Add figures to their respective pages
    for block in figure_blocks:
        page_num = block.get('Page', 1)
        if page_num not in pages_dict:
            pages_dict[page_num] = {'lines': [], 'figures': []}
        pages_dict[page_num]['figures'].append(block)
    
    # Sort pages by page number
    sorted_pages = sorted(pages_dict.items())
    num_pages = len(sorted_pages)
    
    total_lines = sum(len(page_data['lines']) for _, page_data in sorted_pages)
    total_figures = sum(len(page_data['figures']) for _, page_data in sorted_pages)
    logger.info(f"Processing {num_pages} pages with {total_lines} line blocks and {total_figures} figure placeholders")
    
    # Generate HTML elements for each page
    all_pages_html = []
    
    for page_num, page_data in sorted_pages:
        html_elements = []
        
        # First, render figure placeholders
        for fig_idx, block in enumerate(page_data['figures']):
            geometry = block.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            
            if not bbox:
                continue
            
            # Convert normalized coordinates to absolute pixels
            left = bbox.get('Left', 0) * page_width
            top = bbox.get('Top', 0) * page_height
            width = bbox.get('Width', 0) * page_width
            height = bbox.get('Height', 0) * page_height
            
            element_id = f"page{page_num}-figure-{fig_idx}"
            
            # Create figure placeholder as a bordered rectangle
            html_elements.append(f'''
        <div id="{element_id}" class="figure-placeholder" style="
            position: absolute;
            left: {left:.2f}px;
            top: {top:.2f}px;
            width: {width:.2f}px;
            height: {height:.2f}px;
            border: 2px dashed #999;
            background: #f5f5f5;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
            font-size: 12px;
        " data-block-id="{block.get('Id', '')}" data-page="{page_num}" data-type="figure">
            <span>Figure Placeholder</span>
        </div>''')
        
        # Then, render text blocks
        for idx, block in enumerate(page_data['lines']):
            text = block.get('Text', '')
            geometry = block.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            polygon = geometry.get('Polygon', [])
            
            if not bbox:
                continue
            
            # Convert normalized coordinates to absolute pixels
            # Textract BoundingBox: { Left, Top, Width, Height } - all normalized 0-1
            left = bbox.get('Left', 0) * page_width
            top = bbox.get('Top', 0) * page_height
            width = bbox.get('Width', 0) * page_width
            height = bbox.get('Height', 0) * page_height
            
            # Calculate rotation angle - prefer Textract's RotationAngle if available
            rotation_angle = geometry.get('RotationAngle', 0)
            transform_origin = 'top left'
            
            # If Textract didn't detect rotation, try polygon calculation
            if abs(rotation_angle) < 1 and polygon and len(polygon) >= 4:
                # Get the first two points to calculate angle
                p1 = polygon[0]  # Top-left
                p2 = polygon[1]  # Top-right
                
                # Convert to absolute coordinates
                x1 = p1.get('X', 0) * page_width
                y1 = p1.get('Y', 0) * page_height
                x2 = p2.get('X', 0) * page_width
                y2 = p2.get('Y', 0) * page_height
                
                # Calculate angle in degrees
                dx = x2 - x1
                dy = y2 - y1
                rotation_angle = math.degrees(math.atan2(dy, dx))
                
                # Debug log for rotated text
                if abs(rotation_angle) > 1:
                    logger.debug(f"Rotated text detected: '{text[:20]}...' angle={rotation_angle:.2f}°")
            
            # Fallback: Detect vertical text from aspect ratio if polygon detection failed
            if abs(rotation_angle) < 1 and height > 0 and width > 0:
                aspect_ratio = height / width
                # If height is much greater than width (tall & narrow), assume vertical text
                if aspect_ratio > 3.0:  # Height is 3x+ the width
                    rotation_angle = -90  # Rotate counter-clockwise
                    logger.debug(f"Vertical text detected by aspect ratio: '{text[:20]}...' (h/w={aspect_ratio:.1f})")
            
            # Adjust transform origin and positioning for rotated text
            adjust_left = left
            adjust_top = top
            
            if abs(rotation_angle) > 45 and abs(rotation_angle) < 135:
                # Vertical or nearly vertical text
                # For -90 degree rotation, adjust positioning to compensate
                if rotation_angle < 0:  # Counter-clockwise rotation
                    transform_origin = 'top left'
                    # Adjust position to account for rotation
                    adjust_left = left + height  # Move right by the original height
                else:  # Clockwise rotation
                    transform_origin = 'bottom left'
            
            # Detect actual font information from PDF if available
            font_family = 'Times New Roman, Times, serif'
            font_weight = 'normal'
            font_style = 'normal'
            
            if pdf_content:
                try:
                    from utils.pdf_service import get_font_info_from_bbox, map_font_to_reportlab
                    
                    # Convert normalized bbox to absolute coordinates for font detection
                    # Note: page_number is 0-indexed in PyMuPDF
                    font_bbox = {
                        'x': left,
                        'y': top,
                        'width': width,
                        'height': height
                    }
                    
                    font_info = get_font_info_from_bbox(
                        pdf_content=pdf_content,
                        page_number=page_num - 1,  # Convert to 0-indexed
                        bbox=font_bbox
                    )
                    
                    if font_info:
                        font_size = font_info['font_size']
                        
                        # Map PDF font to web font family
                        font_name = font_info['font_name'].lower()
                        if 'times' in font_name:
                            font_family = 'Times New Roman, Times, serif'
                        elif 'helvetica' in font_name or 'arial' in font_name:
                            font_family = 'Arial, Helvetica, sans-serif'
                        elif 'courier' in font_name:
                            font_family = 'Courier New, Courier, monospace'
                        elif 'calibri' in font_name:
                            font_family = 'Calibri, Arial, sans-serif'
                        else:
                            font_family = 'Times New Roman, Times, serif'
                        
                        # Apply font styles
                        font_weight = 'bold' if font_info['is_bold'] else 'normal'
                        font_style = 'italic' if font_info['is_italic'] else 'normal'
                        
                        logger.debug(f"Detected font: {font_info['font_name']} ({font_size:.1f}pt) for '{text[:30]}...'")
                    else:
                        # Fallback to estimation if detection failed
                        if abs(rotation_angle) > 45 and abs(rotation_angle) < 135:
                            font_size = width * 1.0
                        else:
                            font_size = height * 0.8
                        logger.debug(f"Font detection failed, using estimated size: {font_size:.1f}pt")
                        
                except Exception as e:
                    logger.warning(f"Font detection error: {str(e)}, falling back to estimation")
                    # Fallback to estimation
                    if abs(rotation_angle) > 45 and abs(rotation_angle) < 135:
                        font_size = width * 1.0
                    else:
                        font_size = height * 0.8
            else:
                # No PDF content provided, estimate from bounding box
                if abs(rotation_angle) > 45 and abs(rotation_angle) < 135:
                    font_size = width * 1.0
                else:
                    font_size = height * 0.8
            
            # Generate a unique ID for this text element
            element_id = f"page{page_num}-text-block-{idx}"
            
            # Escape HTML special characters in text
            escaped_text = (
                text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#39;')
            )
            
            # Build transform string
            transform = f'rotate({rotation_angle:.2f}deg)' if abs(rotation_angle) > 1 else ''
            transform_style = f'transform: {transform}; transform-origin: {transform_origin};' if transform else ''
            
            # Create positioned div element
            html_elements.append(f'''
        <div id="{element_id}" class="text-block" style="
            position: absolute;
            left: {adjust_left:.2f}px;
            top: {adjust_top:.2f}px;
            width: {width:.2f}px;
            height: {height:.2f}px;
            font-family: {font_family};
            font-size: {font_size:.2f}px;
            font-weight: {font_weight};
            font-style: {font_style};
            line-height: {height:.2f}px;
            overflow: visible;
            white-space: nowrap;
            {transform_style}
        " data-block-id="{block.get('Id', '')}" data-page="{page_num}" data-rotation="{rotation_angle:.2f}">{escaped_text}</div>''')
        
        # Wrap this page's blocks in a page container
        page_html = f'''
    <div class="page" data-page="{page_num}">
        <!-- Page {page_num} text blocks -->
        {''.join(html_elements)}
    </div>'''
        
        all_pages_html.append(page_html)
    
    # Build complete HTML document
    # Build complete HTML document
    html_template = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{template_name} - HTML Template</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Times New Roman', Times, serif;
            background: #f0f0f0;
            margin: 0;
            padding: 20px;
        }}
        
        .page {{
            position: relative;
            width: {page_width}px;
            height: {page_height}px;
            margin: 0 auto 20px auto;
            background: white;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            page-break-after: always;
        }}
        
        .text-block {{
            font-family: 'Times New Roman', Times, serif;
            color: #000000;
        }}
        
        .figure-placeholder {{
            font-family: Arial, sans-serif;
        }}
        
        /* Print-specific styles */
        @media print {{
            body {{
                background: white;
                padding: 0;
            }}
            
            .page {{
                box-shadow: none;
                margin: 0;
                page-break-after: always;
            }}
        }}
        
        @page {{
            size: {page_width}px {page_height}px;
            margin: 0;
        }}
    </style>
</head>
<body>
    {''.join(all_pages_html)}
    
    <script>
        // Template metadata
        const templateMetadata = {{
            name: '{template_name}',
            pageWidth: {page_width},
            pageHeight: {page_height},
            pageCount: {num_pages},
            totalBlockCount: {total_lines},
            totalFigures: {total_figures},
            generatedAt: '{import_datetime()}'
        }};
        
        console.log('Template loaded:', templateMetadata);
    </script>
</body>
</html>'''
    
    return html_template


def _generate_empty_template(template_name: str, page_width: float, page_height: float) -> str:
    """Generate a minimal empty HTML template."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{template_name} - Empty Template</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            margin: 20px;
        }}
        .page {{
            width: {page_width}px;
            height: {page_height}px;
            border: 1px solid #ccc;
            margin: 0 auto;
        }}
    </style>
</head>
<body>
    <div class="page">
        <p>No text blocks found in template.</p>
    </div>
</body>
</html>'''


def import_datetime() -> str:
    """Get current ISO timestamp."""
    from datetime import datetime
    return datetime.utcnow().isoformat() + 'Z'
