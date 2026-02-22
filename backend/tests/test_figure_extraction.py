"""
Tests for LAYOUT_FIGURE extraction and upload functionality.

Tests the new figure extraction feature that:
1. Extracts figure images from PDF using PyMuPDF
2. Uploads them to S3
3. Renders img elements instead of placeholders
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from utils.html_generator import (
    _extract_figure_image_from_pdf,
    _upload_figure_to_s3,
    generate_html_from_textract
)


class TestExtractFigureImage:
    """Tests for PDF figure image extraction."""
    
    def test_extract_figure_returns_bytes(self):
        """Test that figure extraction returns PNG bytes."""
        # Create a simple PDF with PyMuPDF
        try:
            import fitz
            
            # Create a simple 1-page PDF
            doc = fitz.open()
            page = doc.new_page(width=612, height=792)
            
            # Draw a simple rectangle
            rect = fitz.Rect(100, 100, 200, 200)
            page.draw_rect(rect, color=(1, 0, 0), fill=(0.5, 0.5, 0.5))
            
            # Save to bytes
            pdf_bytes = doc.tobytes()
            doc.close()
            
            # Test extraction
            bbox = {'Left': 0.1, 'Top': 0.1, 'Width': 0.2, 'Height': 0.2}
            result = _extract_figure_image_from_pdf(
                pdf_content=pdf_bytes,
                page_num=1,
                bbox=bbox,
                page_width=612,
                page_height=792
            )
            
            assert result is not None
            assert isinstance(result, bytes)
            assert len(result) > 0
            # Check PNG signature
            assert result[:8] == b'\x89PNG\r\n\x1a\n'
            
        except ImportError:
            pytest.skip("PyMuPDF not available")
    
    def test_extract_figure_invalid_page(self):
        """Test extraction with invalid page number."""
        try:
            import fitz
            
            doc = fitz.open()
            doc.new_page(width=612, height=792)
            pdf_bytes = doc.tobytes()
            doc.close()
            
            bbox = {'Left': 0.1, 'Top': 0.1, 'Width': 0.2, 'Height': 0.2}
            result = _extract_figure_image_from_pdf(
                pdf_content=pdf_bytes,
                page_num=99,  # Invalid page
                bbox=bbox,
                page_width=612,
                page_height=792
            )
            
            assert result is None
            
        except ImportError:
            pytest.skip("PyMuPDF not available")
    
    def test_extract_figure_empty_pdf(self):
        """Test extraction with empty/invalid PDF."""
        bbox = {'Left': 0.1, 'Top': 0.1, 'Width': 0.2, 'Height': 0.2}
        result = _extract_figure_image_from_pdf(
            pdf_content=b'invalid pdf data',
            page_num=1,
            bbox=bbox,
            page_width=612,
            page_height=792
        )
        
        assert result is None


class TestUploadFigureToS3:
    """Tests for S3 figure upload."""
    
    @patch('utils.s3_operations.upload_file_to_s3')
    def test_upload_figure_success(self, mock_upload):
        """Test successful figure upload to S3."""
        mock_upload.return_value = {'success': True}
        
        result = _upload_figure_to_s3(
            image_bytes=b'fake png data',
            bucket='test-bucket',
            user_id='user123',
            template_id='template456',
            block_id='block789',
            auth_token='fake-token'
        )
        
        assert result == 'users/user123/templates/template456/images/block789.png'
        mock_upload.assert_called_once()
        
        # Check the call arguments
        call_args = mock_upload.call_args
        assert call_args[1]['bucket'] == 'test-bucket'
        assert call_args[1]['key'] == 'users/user123/templates/template456/images/block789.png'
        assert call_args[1]['content_type'] == 'image/png'
        assert call_args[1]['auth_token'] == 'fake-token'
    
    @patch('utils.s3_operations.upload_file_to_s3')
    def test_upload_figure_failure(self, mock_upload):
        """Test figure upload failure handling."""
        mock_upload.return_value = {'success': False, 'error': 'Upload failed'}
        
        result = _upload_figure_to_s3(
            image_bytes=b'fake png data',
            bucket='test-bucket',
            user_id='user123',
            template_id='template456',
            block_id='block789',
            auth_token='fake-token'
        )
        
        assert result is None
    
    @patch('utils.s3_operations.upload_file_to_s3')
    def test_upload_figure_exception(self, mock_upload):
        """Test figure upload with exception."""
        mock_upload.side_effect = Exception('Network error')
        
        result = _upload_figure_to_s3(
            image_bytes=b'fake png data',
            bucket='test-bucket',
            user_id='user123',
            template_id='template456',
            block_id='block789',
            auth_token='fake-token'
        )
        
        assert result is None


class TestGenerateHtmlWithFigures:
    """Tests for HTML generation with figure extraction."""
    
    @patch('utils.html_generator._upload_figure_to_s3')
    @patch('utils.html_generator._extract_figure_image_from_pdf')
    def test_generate_html_with_figure_extraction(self, mock_extract, mock_upload):
        """Test HTML generation with successful figure extraction."""
        mock_extract.return_value = b'\x89PNG\r\n\x1a\nfake png data'  # minimal PNG-like bytes
        mock_upload.return_value = 'users/user123/templates/template456/images/block123.png'

        blocks = [
            {
                'BlockType': 'PAGE',
                'Id': 'page-1',
                'Page': 1
            },
            {
                'BlockType': 'LAYOUT_FIGURE',
                'Id': 'block123',
                'Page': 1,
                'Geometry': {
                    'BoundingBox': {
                        'Left': 0.1,
                        'Top': 0.1,
                        'Width': 0.2,
                        'Height': 0.2
                    }
                }
            }
        ]

        html = generate_html_from_textract(
            textract_blocks=blocks,
            template_name='test',
            pdf_content=b'fake pdf',
            s3_bucket='test-bucket',
            user_id='user123',
            template_id='template456',
            auth_token='fake-token'
        )

        # Verify img element is rendered with an inline Base64 data URI
        assert '<img' in html
        assert 'class="layout-figure"' in html
        assert 'data-block-id="block123"' in html
        assert 'src="data:image/png;base64,' in html
        # Verify the S3 key is stored for reference but NOT used as src
        assert 'data-s3-key="users/user123/templates/template456/images/block123.png"' in html
        assert 'https://' not in html  # no presigned URL in src

        # Verify extraction and upload were called; presigned URL function is gone
        mock_extract.assert_called_once()
        mock_upload.assert_called_once()
    
    @patch('utils.html_generator._upload_figure_to_s3')
    @patch('utils.html_generator._extract_figure_image_from_pdf')
    def test_generate_html_figure_extraction_failed(self, mock_extract, mock_upload):
        """Test HTML generation with failed figure extraction (fallback to placeholder)."""
        mock_extract.return_value = None  # Extraction failed
        
        blocks = [
            {
                'BlockType': 'PAGE',
                'Id': 'page-1',
                'Page': 1
            },
            {
                'BlockType': 'LAYOUT_FIGURE',
                'Id': 'block123',
                'Page': 1,
                'Geometry': {
                    'BoundingBox': {
                        'Left': 0.1,
                        'Top': 0.1,
                        'Width': 0.2,
                        'Height': 0.2
                    }
                }
            }
        ]
        
        html = generate_html_from_textract(
            textract_blocks=blocks,
            template_name='test',
            pdf_content=b'fake pdf',
            s3_bucket='test-bucket',
            user_id='user123',
            template_id='template456',
            auth_token='fake-token'
        )
        
        # Verify placeholder div is rendered instead
        assert '<div' in html
        assert 'class="layout-figure"' in html
        assert '<span>FIGURE</span>' in html
        assert '<img' not in html
        
        # Verify extraction was called but upload was not
        mock_extract.assert_called_once()
        mock_upload.assert_not_called()
    
    def test_generate_html_without_s3_params(self):
        """Test HTML generation without S3 params (should use placeholders)."""
        blocks = [
            {
                'BlockType': 'PAGE',
                'Id': 'page-1',
                'Page': 1
            },
            {
                'BlockType': 'LAYOUT_FIGURE',
                'Id': 'block123',
                'Page': 1,
                'Geometry': {
                    'BoundingBox': {
                        'Left': 0.1,
                        'Top': 0.1,
                        'Width': 0.2,
                        'Height': 0.2
                    }
                }
            }
        ]
        
        # Call without S3 params
        html = generate_html_from_textract(
            textract_blocks=blocks,
            template_name='test'
        )
        
        # Should render placeholder since S3 params not provided
        assert '<div' in html
        assert 'class="layout-figure"' in html
        assert '<span>FIGURE</span>' in html
        assert '<img' not in html
