import os
import requests
from typing import Dict
from botocore.exceptions import ClientError
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


def fetch_html_template_from_s3(bucket: str, template_id: str, auth_token: str) -> str:
    """
    Fetch HTML template from S3 using presigned URL.
    """
    import jwt
    try:
        # Extract user_sub from JWT token
        payload = jwt.decode(auth_token, options={"verify_signature": False})
        user_sub = payload.get('sub')
        if not user_sub:
            raise Exception("user_sub not found in token")
        s3_key = f"users/{user_sub}/templates/{template_id}/{template_id}.html"

        # Get presigned URL from internal API
        api_endpoint = os.getenv('S3_PRESIGNED_URL_API_ENDPOINT')
        if not api_endpoint:
            raise Exception("S3_PRESIGNED_URL_API_ENDPOINT not set in environment")

        headers = {
            'Authorization': f'Bearer {auth_token}',
            'Content-Type': 'application/json'
        }
        body = {
            'bucket': bucket,
            'key': s3_key,
            'method': 'get'
        }
        presigned_resp = requests.post(api_endpoint, headers=headers, json=body)
        if presigned_resp.status_code != 200:
            logger.error(f"Failed to get presigned URL: {presigned_resp.status_code} {presigned_resp.text}")
            raise Exception(f"Failed to get presigned URL: {presigned_resp.status_code}")
        data = presigned_resp.json()
        presigned_url = data.get('presignedUrl') or data.get('presigned_url')
        if not presigned_url:
            raise Exception("No presigned URL returned from server")

        # Download HTML content
        resp = requests.get(presigned_url)
        if resp.status_code != 200:
            raise Exception(f"Failed to fetch HTML template: {resp.status_code}")
        return resp.text
    except ClientError as e:
        logger.error(f"S3 access denied: {e}")
        raise Exception("S3 access denied")
    except Exception as e:
        logger.error(f"Error fetching HTML template: {e}")
        raise

def replace_html_elements_by_block_id(html_content: str, replacements: Dict[str, str]) -> str:
    """
    Replace element contents using data-block-id attributes.
    """
    soup = BeautifulSoup(html_content, 'lxml')
    for block_id, text in replacements.items():
        element = soup.find(attrs={'data-block-id': block_id})
        if element:
            element.clear()
            element.string = text
        else:
            logger.warning(f"Block ID not found: {block_id}")
    return str(soup)

async def convert_html_to_pdf_playwright(html_content: str, page_format: str = 'Letter') -> bytes:
    """
    Convert modified HTML to PDF using Playwright.
    """
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_content(html_content)
        # Emulate print media to apply @media print styles
        await page.emulate_media(media='print')
        pdf_bytes = await page.pdf(
            print_background=True,
            prefer_css_page_size=True
        )
        await browser.close()
        return pdf_bytes
