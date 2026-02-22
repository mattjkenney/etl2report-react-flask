#!/usr/bin/env python3
"""
Debug script to test figure extraction from a PDF.

Usage:
    python scripts/test_figure_extraction.py <pdf_path> [page_num]

This script will:
1. Load a PDF file
2. Extract figure regions based on specified coordinates
3. Save extracted images to test_output/ directory
4. Print diagnostic information
"""

import os
import sys
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Add project root to path
SCRIPT_DIR = os.path.dirname(__file__)
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
sys.path.insert(0, PROJECT_ROOT)

from backend.utils.html_generator import _extract_figure_image_from_pdf


def test_extraction(pdf_path: str, page_num: int = 1):
    """
    Test figure extraction from a PDF file.
    
    Args:
        pdf_path: Path to PDF file
        page_num: Page number to extract from (1-indexed)
    """
    # Load PDF
    if not os.path.exists(pdf_path):
        logger.error(f"PDF file not found: {pdf_path}")
        return
    
    logger.info(f"Loading PDF: {pdf_path}")
    with open(pdf_path, 'rb') as f:
        pdf_content = f.read()
    
    logger.info(f"PDF size: {len(pdf_content)} bytes")
    
    # Get PDF dimensions
    try:
        import fitz
        doc = fitz.open(stream=pdf_content, filetype="pdf")
        logger.info(f"PDF has {len(doc)} pages")
        
        if page_num < 1 or page_num > len(doc):
            logger.error(f"Invalid page number {page_num} (PDF has {len(doc)} pages)")
            return
        
        page = doc[page_num - 1]
        page_rect = page.rect
        logger.info(f"Page {page_num} dimensions: {page_rect.width}x{page_rect.height}")
        doc.close()
        
        page_width = page_rect.width
        page_height = page_rect.height
        
    except ImportError:
        logger.error("PyMuPDF (fitz) not installed")
        return
    except Exception as e:
        logger.error(f"Error reading PDF: {e}", exc_info=True)
        return
    
    # Test extraction with various bounding boxes
    test_cases = [
        # Format: (name, bbox_dict)
        ("top_left_corner", {'Left': 0.0, 'Top': 0.0, 'Width': 0.2, 'Height': 0.2}),
        ("center", {'Left': 0.4, 'Top': 0.4, 'Width': 0.2, 'Height': 0.2}),
        ("full_page", {'Left': 0.0, 'Top': 0.0, 'Width': 1.0, 'Height': 1.0}),
        ("small_figure", {'Left': 0.1, 'Top': 0.1, 'Width': 0.15, 'Height': 0.15}),
    ]
    
    # Create output directory
    output_dir = os.path.join(SCRIPT_DIR, '..', 'test_output')
    os.makedirs(output_dir, exist_ok=True)
    
    logger.info(f"\nTesting {len(test_cases)} extraction scenarios...")
    
    for name, bbox in test_cases:
        logger.info(f"\n--- Testing: {name} ---")
        logger.info(f"Bounding box: {bbox}")
        
        # Extract figure
        image_bytes = _extract_figure_image_from_pdf(
            pdf_content=pdf_content,
            page_num=page_num,
            bbox=bbox,
            page_width=page_width,
            page_height=page_height
        )
        
        if image_bytes:
            # Save to file
            output_path = os.path.join(output_dir, f"page{page_num}_{name}.png")
            with open(output_path, 'wb') as f:
                f.write(image_bytes)
            logger.info(f"✓ SUCCESS: Extracted {len(image_bytes)} bytes → {output_path}")
        else:
            logger.error(f"✗ FAILED: Could not extract figure for {name}")
    
    logger.info(f"\n✓ Test complete. Check output in: {output_dir}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_figure_extraction.py <pdf_path> [page_num]")
        print("\nExample:")
        print("  python scripts/test_figure_extraction.py my_template.pdf 1")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    page_num = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    
    test_extraction(pdf_path, page_num)
