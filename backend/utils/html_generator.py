"""
HTML Template Generator - Creates HTML templates from PDF layout data.

This module converts PDF Textract analysis results into structured HTML templates
that can be manipulated and later rendered back to PDF using Playwright.

LAYOUT_FIGURE blocks are extracted as images from the PDF and uploaded to S3,
then rendered as img elements. Text blocks that fall within figure boundaries
are ignored. Layout blocks such as `LAYOUT_TEXT` are rendered as container `div`s
nested inside their parent `PAGE` container, and child `LINE` blocks for a
`LAYOUT_TEXT` are rendered as positioned elements inside that layout container.
"""

import base64
import logging
import math
import re
import io
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


def _extract_figure_image_from_pdf(
    pdf_content: bytes,
    page_num: int,
    bbox: Dict[str, float],
    page_width: float,
    page_height: float
) -> Optional[bytes]:
    """
    Extract a figure region from a PDF page as a PNG image.
    
    Args:
        pdf_content: PDF file content as bytes
        page_num: Page number (1-indexed)
        bbox: Bounding box dict with Top, Left, Width, Height (normalized 0-1)
        page_width: Page width in points
        page_height: Page height in points
        
    Returns:
        PNG image bytes, or None if extraction fails
    """
    try:
        import fitz  # PyMuPDF
        
        # Open PDF from bytes
        pdf_doc = fitz.open(stream=pdf_content, filetype="pdf")
        
        # Get page (0-indexed in PyMuPDF)
        if page_num < 1 or page_num > len(pdf_doc):
            logger.error(f"Invalid page number {page_num} for PDF with {len(pdf_doc)} pages")
            return None
            
        page = pdf_doc[page_num - 1]
        
        # Get actual page dimensions from PDF
        page_rect = page.rect
        actual_page_width = page_rect.width
        actual_page_height = page_rect.height
        
        logger.info(f"Page {page_num} dimensions: {actual_page_width}x{actual_page_height} (passed: {page_width}x{page_height})")
        
        # Convert normalized coordinates to absolute coordinates using actual page dimensions
        left = bbox.get('Left', 0) * actual_page_width
        top = bbox.get('Top', 0) * actual_page_height
        width = bbox.get('Width', 0) * actual_page_width
        height = bbox.get('Height', 0) * actual_page_height
        
        # Validate dimensions
        if width <= 0 or height <= 0:
            logger.error(f"Invalid figure dimensions: {width:.2f}x{height:.2f}")
            pdf_doc.close()
            return None
        
        logger.info(f"Extracting figure at ({left:.2f}, {top:.2f}) size {width:.2f}x{height:.2f}")
        
        # Create rectangle for cropping (x0, y0, x1, y1)
        rect = fitz.Rect(left, top, left + width, top + height)
        
        # Ensure rectangle is within page bounds
        page_rect = page.rect
        if not rect.intersects(page_rect):
            logger.error(f"Figure rectangle {rect} is outside page bounds {page_rect}")
            pdf_doc.close()
            return None
        
        # Clip to page bounds if necessary
        rect = rect & page_rect  # Intersection
        
        # Get the page's pixmap at original resolution
        # Use matrix for high quality (2x zoom for better quality)
        mat = fitz.Matrix(2, 2)
        pix = page.get_pixmap(matrix=mat, clip=rect)
        
        # Check if pixmap is valid
        if pix is None or pix.width == 0 or pix.height == 0:
            logger.error(f"Failed to create valid pixmap: width={pix.width if pix else 'None'}, height={pix.height if pix else 'None'}")
            pdf_doc.close()
            return None
        
        # Convert pixmap to PNG bytes
        png_bytes = pix.tobytes("png")
        
        pdf_doc.close()
        
        logger.info(f"Extracted figure from page {page_num}: {len(png_bytes)} bytes")
        return png_bytes
        
    except ImportError:
        logger.error("PyMuPDF (fitz) not available for image extraction")
        return None
    except Exception as e:
        logger.error(f"Failed to extract figure image: {str(e)}", exc_info=True)
        return None


def _upload_figure_to_s3(
    image_bytes: bytes,
    bucket: str,
    user_id: str,
    template_id: str,
    block_id: str,
    auth_token: str
) -> Optional[str]:
    """
    Upload a figure image to S3 and return the S3 key.
    
    Args:
        image_bytes: PNG image bytes
        bucket: S3 bucket name
        user_id: User ID for path
        template_id: Template ID for path
        block_id: Bounding box block ID (used as filename)
        auth_token: JWT auth token
        
    Returns:
        S3 key if successful, None otherwise
    """
    try:
        from utils.s3_operations import upload_file_to_s3
        
        # Build S3 key according to process.yaml structure
        s3_key = f"users/{user_id}/templates/{template_id}/images/{block_id}.png"
        
        logger.info(f"Uploading figure image to S3: {bucket}/{s3_key} ({len(image_bytes)} bytes)")
        
        # Upload with retries (upload_file_to_s3 handles the retry logic)
        result = upload_file_to_s3(
            bucket=bucket,
            key=s3_key,
            file_data=image_bytes,
            content_type='image/png',
            auth_token=auth_token,
            user_id=user_id,
            description=f"Figure image for block {block_id}"
        )
        
        if result.get('success'):
            logger.info(f"Successfully uploaded figure image to S3: {s3_key}")
            return s3_key
        else:
            logger.error(f"Failed to upload figure image: {result.get('error', 'Unknown error')}")
            return None
            
    except Exception as e:
        logger.error(f"Exception uploading figure to S3: {str(e)}", exc_info=True)
        return None



def _calculate_font_size(height_px: float) -> float:
    """
    Calculate font-size by rounding to nearest even whole number.
    If result is 0, return 1px.
    """
    if height_px <= 0:
        return 1.0
    # Round to nearest even number
    rounded = round(height_px / 2) * 2
    return max(1.0, float(rounded))


def _render_line_with_spaces(text: str, word_child_ids: List[str], words_by_id: Dict[str, Any]) -> str:
    """
    Render LINE text preserving whitespace by wrapping each space in a span.
    Also matches words with WORD blocks and adds data-block-id attributes.
    
    Args:
        text: The LINE text content
        word_child_ids: List of WORD block IDs that are children of this LINE
        words_by_id: Dictionary mapping WORD block IDs to WORD blocks
    
    Returns:
        HTML string with words and spaces wrapped in spans
    """
    # Split text into words and spaces (preserving all whitespace)
    # This regex splits on spaces but keeps them as separate tokens
    tokens = re.split(r'( +)', text)
    
    html_parts = []
    word_idx = 0
    
    for token in tokens:
        if not token:  # Skip empty strings
            continue
            
        # Escape HTML entities
        escaped_token = (
            token.replace('&', '&amp;')
                 .replace('<', '&lt;')
                 .replace('>', '&gt;')
                 .replace('"', '&quot;')
                 .replace("'", '&#39;')
        )
        
        if token.strip():  # It's a word (not just whitespace)
            span_data_id = ''
            # Try to match with WORD block
            if word_idx < len(word_child_ids):
                word_block = words_by_id.get(word_child_ids[word_idx])
                if word_block and word_block.get('Text', '') == token:
                    span_data_id = f' data-block-id="{word_block.get("Id", "")}"'
                    word_idx += 1
                else:
                    # Try to find matching WORD block in remaining children
                    found = False
                    for look_ahead in range(word_idx + 1, len(word_child_ids)):
                        word_block = words_by_id.get(word_child_ids[look_ahead])
                        if word_block and word_block.get('Text', '') == token:
                            span_data_id = f' data-block-id="{word_block.get("Id", "")}"'
                            word_idx = look_ahead + 1
                            found = True
                            break
                    if not found:
                        word_idx += 1
            html_parts.append(f'<span{span_data_id}>{escaped_token}</span>')
        else:  # It's whitespace (one or more spaces)
            # Wrap each individual space character in a span
            for char in token:
                html_parts.append('<span> </span>')
    
    return ''.join(html_parts)


def generate_html_from_textract(
    textract_blocks: List[Dict[str, Any]],
    template_name: str,
    page_width: float = 612,  # 8.5 inches at 72 DPI
    page_height: float = 792,   # 11 inches at 72 DPI
    pdf_content: Optional[bytes] = None,  # Optional PDF content for font detection and figure extraction
    s3_bucket: Optional[str] = None,  # S3 bucket for figure image uploads
    user_id: Optional[str] = None,  # User ID for S3 path
    template_id: Optional[str] = None,  # Template ID for S3 path
    auth_token: Optional[str] = None  # JWT token for S3 operations
) -> str:
    # Map PDF font names to CSS font-family
    PDF_TO_CSS_FONT_MAP = {
        'Times-Roman': 'Times New Roman, Times, serif',
        'TimesNewRomanPSMT': 'Times New Roman, Times, serif',
        'Helvetica': 'Arial, Helvetica, sans-serif',
        'ArialMT': 'Arial, Helvetica, sans-serif',
        'Courier': 'Courier New, Courier, monospace',
        'CourierNewPSMT': 'Courier New, Courier, monospace',
        'Symbol': 'Symbol, serif',
        'ZapfDingbats': 'Zapf Dingbats, serif',
    }
    """
    Generate an HTML template from Textract blocks.
    
    Args:
        textract_blocks: List of Textract block dictionaries containing text and bounding boxes
        template_name: Name of the template for metadata
        page_width: PDF page width in points (default: US Letter)
        page_height: PDF page height in points (default: US Letter)
        pdf_content: Optional PDF content as bytes for font detection and figure extraction
        s3_bucket: Optional S3 bucket name for uploading extracted figure images
        user_id: Optional user ID for S3 path construction
        template_id: Optional template ID for S3 path construction
        auth_token: Optional JWT token for S3 upload authentication
        
    Returns:
        HTML string with absolute positioned elements matching PDF layout
    """
    # Filter for LAYOUT_FIGURE and LAYOUT_TABLE blocks (to render as placeholders)
    figure_blocks = [
        block for block in textract_blocks 
        if block.get('BlockType') in ('LAYOUT_FIGURE', 'LAYOUT_TABLE')
    ]
    
    # Filter for LINE blocks (contain text with accurate positioning)
    line_blocks = [
        block for block in textract_blocks 
        if block.get('BlockType') == 'LINE' and block.get('Text')
    ]
    
    # Filter for WORD blocks (individual words within lines)
    word_blocks = [
        block for block in textract_blocks 
        if block.get('BlockType') == 'WORD' and block.get('Text')
    ]
    
    if not line_blocks and not figure_blocks and not word_blocks:
        logger.warning("No LINE, WORD, or LAYOUT_FIGURE/LAYOUT_TABLE blocks found in Textract data")
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
    
    # Build a map of blocks by id for fast lookup
    blocks_by_id = {block.get('Id'): block for block in textract_blocks if block.get('Id')}
    
    # Build a map of words by id for fast lookup
    words_by_id = {block.get('Id'): block for block in word_blocks if block.get('Id')}
    
    # Build a set of WORD IDs that are children of LINE blocks
    line_child_word_ids = set()
    for line_block in line_blocks:
        for rel in line_block.get('Relationships', []) or []:
            if rel.get('Type') == 'CHILD':
                line_child_word_ids.update(rel.get('Ids', []))

    # Identify LAYOUT blocks (LAYOUT_TEXT, LAYOUT_FIGURE, LAYOUT_TABLE) and record their child LINE ids
    layout_blocks_by_id = {}
    for block in textract_blocks:
        if block.get('BlockType') in ('LAYOUT_TEXT', 'LAYOUT_FIGURE', 'LAYOUT_TABLE'):
            child_ids = []
            for rel in block.get('Relationships', []) or []:
                if rel.get('Type') == 'CHILD':
                    child_ids.extend(rel.get('Ids', []))
            layout_blocks_by_id[block.get('Id')] = {'block': block, 'child_ids': child_ids}

    # Group pages using PAGE blocks when present; otherwise fall back to line page numbers
    pages = {}
    page_blocks = [b for b in textract_blocks if b.get('BlockType') == 'PAGE']

    if page_blocks:
        for pblock in page_blocks:
            page_num = pblock.get('Page', 1)
            pages[page_num] = {'page_block': pblock, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}

        # Attach layout blocks to their page
        for lb in layout_blocks_by_id.values():
            block = lb['block']
            page_num = block.get('Page', 1)
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['layout_blocks'].append(block)

        # Attach figures to pages (if any) — only those NOT already handled as layout blocks
        for fig in figure_blocks:
            if fig.get('Id') in layout_blocks_by_id:
                continue  # already rendered in the layout_blocks pass; skip to avoid duplicate placeholder
            page_num = fig.get('Page', 1)
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['figures'].append(fig)

        # Find line ids assigned to layouts so we don't duplicate rendering
        assigned_line_ids = set()
        for lb in layout_blocks_by_id.values():
            for cid in lb['child_ids']:
                assigned_line_ids.add(cid)

        # Add LINE blocks not assigned to layout blocks as loose lines
        for block in line_blocks:
            if block.get('Id') in assigned_line_ids:
                continue
            page_num = block.get('Page', 1)
            geometry = block.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            # Skip text blocks that are inside figure blocks
            if bbox and is_inside_figure(bbox, page_num, figures_by_page):
                logger.debug(f"Skipping text block inside figure: '{block.get('Text', '')[:30]}...'")
                continue
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['loose_lines'].append(block)
        
        # Add standalone WORD blocks (not children of LINE blocks)
        for word in word_blocks:
            if word.get('Id') in line_child_word_ids:
                continue
            page_num = word.get('Page', 1)
            geometry = word.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            if bbox and is_inside_figure(bbox, page_num, figures_by_page):
                logger.debug(f"Skipping standalone word inside figure: '{word.get('Text', '')[:30]}...'")
                continue
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['loose_words'].append(word)

    else:
        for block in line_blocks:
            page_num = block.get('Page', 1)
            geometry = block.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            if bbox and is_inside_figure(bbox, page_num, figures_by_page):
                logger.debug(f"Skipping text block inside figure: '{block.get('Text', '')[:30]}...'")
                continue
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['loose_lines'].append(block)
        for block in figure_blocks:
            page_num = block.get('Page', 1)
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['figures'].append(block)
        # Add standalone WORD blocks
        for word in word_blocks:
            if word.get('Id') in line_child_word_ids:
                continue
            page_num = word.get('Page', 1)
            geometry = word.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            if bbox and is_inside_figure(bbox, page_num, figures_by_page):
                logger.debug(f"Skipping standalone word inside figure: '{word.get('Text', '')[:30]}...'")
                continue
            if page_num not in pages:
                pages[page_num] = {'page_block': None, 'layout_blocks': [], 'loose_lines': [], 'figures': [], 'loose_words': []}
            pages[page_num]['loose_words'].append(word)
    
    # Sort pages by page number
    sorted_pages = sorted(pages.items())
    num_pages = len(sorted_pages)

    total_lines = sum(len(page_data['loose_lines']) for _, page_data in sorted_pages)
    total_lines += sum(len(lb.get('child_ids') or []) for lb in layout_blocks_by_id.values())
    total_figures = sum(len(page_data['figures']) for _, page_data in sorted_pages)
    logger.info(f"Processing {num_pages} pages with {total_lines} line blocks and {total_figures} figure placeholders")
    
    # Generate HTML elements for each page
    all_pages_html = []
    
    for page_num, page_data in sorted_pages:
        html_elements = []

        # Render layout blocks (nested containers)
        for lidx, layout_block in enumerate(page_data.get('layout_blocks', [])):
            ltype = layout_block.get('BlockType')
            geometry = layout_block.get('Geometry', {})
            lbbox = geometry.get('BoundingBox', {})
            if not lbbox:
                continue
            left = lbbox.get('Left', 0) * page_width
            top = lbbox.get('Top', 0) * page_height
            width = lbbox.get('Width', 0) * page_width
            height = lbbox.get('Height', 0) * page_height

            container_id = f"page{page_num}-{ltype.lower()}-{lidx}"

            if ltype == 'LAYOUT_FIGURE':
                block_id = layout_block.get('Id', '')
                
                # Try to extract figure image and embed it as a Base64 data URI.
                # Using a data URI avoids all presigned-URL expiry and network issues
                # when Playwright renders the HTML into a PDF.
                figure_uploaded = False
                figure_data_uri = None
                original_s3_key = None

                if pdf_content:
                    logger.info(f"Attempting to extract figure {block_id} on page {page_num}")

                    # Extract image from PDF
                    image_bytes = _extract_figure_image_from_pdf(
                        pdf_content=pdf_content,
                        page_num=page_num,
                        bbox=lbbox,
                        page_width=page_width,
                        page_height=page_height
                    )

                    if image_bytes:
                        # Encode directly as a Base64 data URI — no network call needed at render time
                        b64 = base64.b64encode(image_bytes).decode('ascii')
                        figure_data_uri = f"data:image/png;base64,{b64}"
                        figure_uploaded = True
                        logger.info(f"✓ Encoded figure {block_id} as data URI ({len(image_bytes)} bytes)")

                        # Also upload to S3 for permanent storage / future reference
                        if all([s3_bucket, user_id, template_id, auth_token]):
                            s3_key = _upload_figure_to_s3(
                                image_bytes=image_bytes,
                                bucket=s3_bucket,
                                user_id=user_id,
                                template_id=template_id,
                                block_id=block_id,
                                auth_token=auth_token
                            )
                            if s3_key:
                                original_s3_key = s3_key
                                logger.info(f"Figure also uploaded to S3: {s3_key}")
                            else:
                                logger.warning(f"S3 upload failed for block {block_id} (data URI still used for rendering)")
                        else:
                            logger.debug(f"Skipping S3 upload - missing parameters")
                    else:
                        logger.warning(f"Image extraction failed for block {block_id}")
                else:
                    logger.debug(f"Skipping figure extraction — no pdf_content provided")

                # Render as img element if extraction succeeded, otherwise use placeholder
                logger.info(f"Rendering decision for block {block_id}: figure_uploaded={figure_uploaded}")
                if figure_uploaded and figure_data_uri:
                    # src is a data URI — renders offline with no expiry, no network dependency
                    s3_key_attr = f' data-s3-key="{original_s3_key}"' if original_s3_key else ''
                    img_html = f'''<img id="{container_id}" class="layout-figure" src="{figure_data_uri}"{s3_key_attr} style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; width: {width:.2f}px; height: {height:.2f}px;" data-block-id="{block_id}" data-page="{page_num}" alt="Figure {lidx + 1}">'''
                    html_elements.append(f'''
        {img_html}''')
                    logger.info(f"✓ Rendered img element for block {block_id} as inline data URI")
                else:
                    # Fallback to placeholder
                    logger.warning(f"Using placeholder for LAYOUT_FIGURE block {block_id} on page {page_num} (figure_uploaded={figure_uploaded})")
                    html_elements.append(f'''
        <div id="{container_id}" class="layout-figure" style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; width: {width:.2f}px; height: {height:.2f}px; border: 2px dashed #999; background: #f5f5f5; display:flex; align-items:center; justify-content:center;" data-block-id="{block_id}" data-page="{page_num}">
            <span>FIGURE</span>
        </div>''')
                continue
            
            if ltype == 'LAYOUT_TABLE':
                html_elements.append(f'''
        <div id="{container_id}" class="layout-table" style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; width: {width:.2f}px; height: {height:.2f}px; border: 2px dashed #999; background: #f5f5f5; display:flex; align-items:center; justify-content:center;" data-block-id="{layout_block.get('Id','')}" data-page="{page_num}">
            <span>TABLE</span>
        </div>''')
                continue

            # LAYOUT_TEXT: render child LINEs inside the container
            child_ids = layout_blocks_by_id.get(layout_block.get('Id'), {}).get('child_ids', [])
            child_html = []
            for idx, cid in enumerate(child_ids):
                child_block = blocks_by_id.get(cid)
                if not child_block or child_block.get('BlockType') != 'LINE':
                    continue
                geometry = child_block.get('Geometry', {})
                bbox = geometry.get('BoundingBox', {})
                if not bbox:
                    continue
                if is_inside_figure(bbox, page_num, figures_by_page):
                    logger.debug(f"Skipping text block inside figure from layout: '{child_block.get('Text', '')[:30]}...'")
                    continue

                l_left = bbox.get('Left', 0) * page_width
                l_top = bbox.get('Top', 0) * page_height
                l_width = bbox.get('Width', 0) * page_width
                l_height = bbox.get('Height', 0) * page_height

                rel_left = l_left - left
                rel_top = l_top - top

                # Check if this LINE block has WORD children
                word_child_ids = []
                for rel in child_block.get('Relationships', []) or []:
                    if rel.get('Type') == 'CHILD':
                        word_child_ids.extend(rel.get('Ids', []))
                
                # Render each word in the LINE as a span, with data-block-id if a matching WORD block exists
                text = child_block.get('Text', '')
                font_size = _calculate_font_size(l_height)
                font_weight = 'normal'
                # Get WORD children in order
                word_child_ids = []
                for rel in child_block.get('Relationships', []) or []:
                    if rel.get('Type') == 'CHILD':
                        word_child_ids.extend(rel.get('Ids', []))
                
                # Render line with preserved whitespace
                line_html = _render_line_with_spaces(text, word_child_ids, words_by_id)
                child_html.append(f'''
            <div class="text-block" style="position: absolute; left: {rel_left:.2f}px; top: {rel_top:.2f}px; width: {l_width:.2f}px; height: {l_height:.2f}px; font-size: {font_size:.2f}px; line-height: {l_height:.2f}px; font-weight: {font_weight}; font-family: 'Times New Roman', Times, serif; white-space: nowrap;" data-block-id="{child_block.get('Id','')}" data-page="{page_num}">{line_html}</div>''')

            html_elements.append(f'''
        <div id="{container_id}" class="layout-text" style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; width: {width:.2f}px; height: {height:.2f}px;" data-block-id="{layout_block.get('Id','')}" data-page="{page_num}">
            {''.join(child_html)}
        </div>''')

        # Then render figures that were not layout children
        for fig_idx, block in enumerate(page_data.get('figures', [])):
            geometry = block.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            if not bbox:
                continue
            left = bbox.get('Left', 0) * page_width
            top = bbox.get('Top', 0) * page_height
            width = bbox.get('Width', 0) * page_width
            height = bbox.get('Height', 0) * page_height
            element_id = f"page{page_num}-figure-{fig_idx}"
            block_type = block.get('BlockType', 'LAYOUT_FIGURE')
            placeholder_text = 'TABLE' if block_type == 'LAYOUT_TABLE' else 'FIGURE'
            html_elements.append(f'''
        <div id="{element_id}" class="figure-placeholder" style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; width: {width:.2f}px; height: {height:.2f}px; border: 2px dashed #999; background: #f5f5f5; display:flex; align-items:center; justify-content:center;" data-block-id="{block.get('Id', '')}" data-page="{page_num}" data-type="{block_type.lower()}">
            <span>{placeholder_text}</span>
        </div>''')

        # Then render loose lines that aren't part of any layout block
        for idx, block in enumerate(page_data.get('loose_lines', [])):
            text = block.get('Text', '')
            geometry = block.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            if not bbox:
                continue

            left = bbox.get('Left', 0) * page_width
            top = bbox.get('Top', 0) * page_height
            width = bbox.get('Width', 0) * page_width
            height = bbox.get('Height', 0) * page_height

            font_size = _calculate_font_size(height)
            font_weight = 'normal'

            escaped_text = (
                text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#39;')
            )

            element_id = f"page{page_num}-text-block-{idx}"
            
            # Check if this LINE block has WORD children
            child_ids = []
            for rel in block.get('Relationships', []) or []:
                if rel.get('Type') == 'CHILD':
                    child_ids.extend(rel.get('Ids', []))
            
            # Render each word in the LINE as a span, with data-block-id if a matching WORD block exists
            text = block.get('Text', '')
            # Get WORD children in order
            word_child_ids = []
            for rel in block.get('Relationships', []) or []:
                if rel.get('Type') == 'CHILD':
                    word_child_ids.extend(rel.get('Ids', []))
            
            # Render line with preserved whitespace
            line_html = _render_line_with_spaces(text, word_child_ids, words_by_id)
            html_elements.append(f'''
        <div id="{element_id}" class="text-block" style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; width: {width:.2f}px; height: {height:.2f}px; font-size: {font_size:.2f}px; line-height: {height:.2f}px; font-weight: {font_weight}; font-family: 'Times New Roman', Times, serif; white-space: nowrap;" data-block-id="{block.get('Id', '')}" data-page="{page_num}">{line_html}</div>''')
        
        # Render standalone WORD blocks (not children of LINE blocks)
        for idx, word in enumerate(page_data.get('loose_words', [])):
            text = word.get('Text', '')
            geometry = word.get('Geometry', {})
            bbox = geometry.get('BoundingBox', {})
            if not bbox:
                continue

            left = bbox.get('Left', 0) * page_width
            top = bbox.get('Top', 0) * page_height
            width = bbox.get('Width', 0) * page_width
            height = bbox.get('Height', 0) * page_height

            font_size = _calculate_font_size(height)
            font_weight = 'normal'
            font_family = 'Times New Roman, Times, serif'

            escaped_text = (
                text.replace('&', '&amp;')
                    .replace('<', '&lt;')
                    .replace('>', '&gt;')
                    .replace('"', '&quot;')
                    .replace("'", '&#39;')
            )

            element_id = f"page{page_num}-word-{idx}"
            html_elements.append(f'''
        <div id="{element_id}" class="word-block" style="position: absolute; left: {left:.2f}px; top: {top:.2f}px; font-size: {font_size:.2f}px; font-weight: {font_weight}; font-family: {font_family}; white-space: nowrap;" data-block-id="{word.get('Id', '')}" data-page="{page_num}">{escaped_text}</div>''')

        # Wrap this page's blocks in a page container
        page_html = f'''
    <div class="page" data-page="{page_num}">
        <!-- Page {page_num} blocks -->
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
        
        /* Make word elements inline-block and preserve whitespace */
        .word {{
            display: inline-block;
            white-space: pre;
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
        
        // Note: Figure images use presigned S3 URLs which expire after 1 hour.
        // If images fail to load, the HTML template needs to be regenerated.
    </script>
</body>
</html>'''
    
    # Log statistics about generated HTML
    img_count = html_template.count('<img')
    figure_div_count = html_template.count('class="layout-figure"') - img_count  # Subtract img tags
    logger.info(f"Generated HTML statistics: {img_count} img elements, {figure_div_count} figure placeholder divs")
    
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
