import { fetchAuthSession } from 'aws-amplify/auth';

async function getAuthSession() {
    try {
        const session = await fetchAuthSession();
        if (!session.tokens?.idToken) {
            throw new Error('No ID token found in session');
        }
        
        // Get the JWT token
        const token = session.tokens.idToken;
        const jwtToken = token.toString();

        return {
            token: jwtToken,
            sub: token.payload.sub
        };
    } catch (error) {
        console.error('Error getting auth session:', error);
        throw new Error('Failed to get authentication token: ' + error.message);
    }
}

export async function uploadFile(file, bucketName, key, description = '') {
    try {
        console.log('uploadFile called with:', { fileName: file?.name, bucketName, key, description });
        
        // Get the auth session details
        const { token } = await getAuthSession();
        console.log('Got auth token, length:', token?.length);
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!file) {
            throw new Error('File is required');
        }
        if (!bucketName) {
            throw new Error('Bucket name is required');
        }
        if (!key) {
            throw new Error('Key is required');
        }
        
        // Get Flask backend endpoint
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/s3/upload`;

        // Create form data for multipart upload
        const formData = new FormData();
        formData.append('file', file);
        formData.append('bucket', bucketName);
        formData.append('key', key);
        formData.append('content_type', file.type);
        if (description) {
            formData.append('description', description);
        }

        console.log('Making fetch request to:', apiEndpoint);
        console.log('FormData entries:', Array.from(formData.entries()).map(([k, v]) => 
            k === 'file' ? [k, `File: ${v.name}`] : [k, v]
        ));
        
        // Upload to backend
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        }).catch(err => {
            // Network error - couldn't reach the API endpoint
            console.error('Fetch error details:', {
                name: err.name,
                message: err.message,
                stack: err.stack
            });
            throw new Error(`Network error: Could not reach API endpoint at ${apiEndpoint}. ${err.message}`);
        });

        console.log('Fetch response received:', { ok: response.ok, status: response.status, statusText: response.statusText });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `File upload failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message || 'File upload failed');
        }

        // Return success data
        return {
            success: true,
            message: data.message || 'File uploaded successfully',
            bucket: data.bucket,
            key: data.key,
            fileName: data.file_name
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

export async function startTextractAnalysis(bucket, key, outputBucket, outputKeyPrefix = null) {
    try {
        // Get the auth session details
        const { token } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!bucket) {
            throw new Error('Bucket is required');
        }
        if (!key) {
            throw new Error('Key is required');
        }
        if (!outputBucket) {
            throw new Error('Output bucket is required');
        }
        
        // Get Flask backend endpoint
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/textract/start-analysis`;

        // Call the backend API
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucket: bucket,
                key: key,
                output_bucket: outputBucket,
                output_key_prefix: outputKeyPrefix
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to start Textract analysis: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.job_id) {
            throw new Error('No job ID returned from Textract service');
        }

        // Return success data
        return {
            success: true,
            jobId: data.job_id,
            status: data.status,
            outputLocation: data.output_location
        };
    } catch (error) {
        console.error('Error starting Textract analysis:', error);
        throw error;
    }
}

/**
 * Poll Textract job until completion and retrieve all results with pagination.
 * Server-side polling reduces frontend network calls and complexity.
 * Textract document analysis typically takes 2-5 minutes to complete.
 * 
 * @param {string} jobId - The Textract job ID
 * @param {number} pollInterval - Polling interval in milliseconds (default: 10000 = 10 seconds)
 * @param {number} maxAttempts - Maximum number of polling attempts (default: 60 = 10 minutes)
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {Promise<Object>} Complete Textract results
 */
export async function pollTextractResults(jobId, pollInterval = 10000, maxAttempts = 60, onProgress = null) {
    try {
        // Get the auth session details
        const { token } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!jobId) {
            throw new Error('Job ID is required');
        }
        
        // Get Flask backend endpoint
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/textract/poll-results`;

        // Note: Backend handles polling server-side, so this is a single call
        // The backend will poll every `poll_interval` seconds for up to `max_attempts` times
        // This may take several minutes for complex documents
        
        console.log(`Starting Textract polling (server-side): jobId=${jobId}, max wait time=${(pollInterval * maxAttempts) / 60000} minutes`);
        
        if (onProgress) {
            onProgress({
                attempt: 0,
                maxAttempts: maxAttempts,
                jobStatus: 'IN_PROGRESS',
                statusMessage: 'Polling for results (server-side)... This may take several minutes.'
            });
        }
        
        // Call the backend API (handles polling server-side)
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: jobId,
                poll_interval: pollInterval,
                max_attempts: maxAttempts
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to poll Textract results: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to poll Textract results');
        }
        
        // Call final progress callback
        if (onProgress) {
            onProgress({
                attempt: maxAttempts,
                maxAttempts: maxAttempts,
                jobStatus: data.job_status,
                statusMessage: 'Completed',
                totalBlocks: data.blocks_count
            });
        }
        
        // Return complete results (convert snake_case to camelCase for compatibility)
        return {
            success: true,
            jobStatus: data.job_status,
            statusMessage: 'Completed',
            blocks: data.blocks || [],
            documentMetadata: data.document_metadata,
            totalBlocks: data.blocks_count
        };
        
    } catch (error) {
        console.error('Error polling Textract results:', error);
        throw error;
    }
}

/**
 * List sub-folders or files in an S3 bucket under a specified parent folder.
 * 
 * @param {string} bucket - The S3 bucket name
 * @param {string} parentFolder - The parent folder path (optional, defaults to user's root)
 * @param {boolean} listFiles - If true, lists files; if false, lists folders (default: false)
 * @returns {Promise<Object>} Object containing array of folder names or file objects
 */
export async function listS3Objects(bucket, parentFolder = '', listFiles = false) {
    try {
        // Get the auth session details
        const { token } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!bucket) {
            throw new Error('Bucket name is required');
        }
        
        // Get Flask backend endpoint
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/s3/list-objects`;

        // Call the backend API
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucket: bucket,
                parent_folder: parentFolder,
                list_files: listFiles
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to list S3 ${listFiles ? 'files' : 'folders'}: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Failed to list S3 objects');
        }
        
        // Return success data
        if (listFiles) {
            return {
                success: true,
                files: data.files || [],
                bucket: data.bucket,
                parentFolder: data.parent_folder,
                prefix: data.prefix,
                count: data.count || 0
            };
        } else {
            return {
                success: true,
                folders: data.folders || [],
                bucket: data.bucket,
                parentFolder: data.parent_folder
            };
        }
    } catch (error) {
        console.error(`Error listing S3 ${listFiles ? 'files' : 'folders'}:`, error);
        throw error;
    }
}

/**
 * Get a presigned URL for downloading a file from S3.
 * 
 * @param {string} bucket - The S3 bucket name
 * @param {string} key - The S3 object key (file path)
 * @returns {Promise<string>} The presigned URL for GET operation
 */
export async function getPresignedUrlForGet(bucket, key) {
    try {
        // Get the auth session details
        const { token } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!bucket) {
            throw new Error('Bucket name is required');
        }
        if (!key) {
            throw new Error('Key is required');
        }
        
        // Get Flask backend endpoint
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/s3/presigned-url`;

        // Call the backend API
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucket: bucket,
                key: key,
                method: 'get'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get presigned URL: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.presigned_url) {
            throw new Error('No presigned URL returned from server');
        }
        
        // Return the presigned URL
        return data.presigned_url;
    } catch (error) {
        console.error('Error getting presigned URL for GET:', error);
        throw error;
    }
}

/**
 * Get Textract results from S3 for a specific template.
 * Backend handles listing and fetching all Textract output files.
 * 
 * @param {string} bucket - The S3 bucket name
 * @param {string} templateName - The template name
 * @returns {Promise<Object>} Object with combined blocks array from all files and metadata
 */
export async function getTextractResultsFromS3(bucket, templateName) {
    try {
        // Get the auth session details
        const { token } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!bucket) {
            throw new Error('Bucket name is required');
        }
        if (!templateName) {
            throw new Error('Template name is required');
        }
        
        // Get Flask backend endpoint
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/textract/get-results-from-s3`;
        
        console.log(`Fetching Textract results from S3 for template: ${templateName}`);
        
        // Call the backend API (handles list + fetch server-side)
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucket: bucket,
                template_name: templateName
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to get Textract results from S3: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to get Textract results from S3');
        }
        
        console.log(`Total blocks fetched: ${data.blocks_count}`);
        
        // Return success data with metadata (convert snake_case to camelCase for compatibility)
        return {
            success: true,
            blocks: data.blocks || [],
            blocksCount: data.blocks_count,
            filesCount: data.files_count,
            fileNames: data.file_names || []
        };
    } catch (error) {
        console.error('Error getting Textract results from S3:', error);
        throw error;
    }
}
/**
 * Convert PDF to HTML template using Textract blocks.
 * 
 * @param {string} templateName - The name of the template
 * @param {Array} textractBlocks - Array of Textract block objects
 * @param {number} pageWidth - Optional page width in points (default: 612)
 * @param {number} pageHeight - Optional page height in points (default: 792)
 * @returns {Promise<Object>} Object containing HTML content and metadata
 */
export async function convertPdfToHtml(templateName, textractBlocks, pageWidth = 612, pageHeight = 792, pdfS3Bucket = null, pdfS3Key = null) {
    try {
        // Get the auth session details
        const { token } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!templateName) {
            throw new Error('Template name is required');
        }
        if (!Array.isArray(textractBlocks)) {
            throw new Error('Textract blocks must be an array');
        }
        
        // Get Flask backend endpoint from environment
        const backendEndpoint = import.meta.env.VITE_FLASK_BACKEND_URL || 'http://localhost:5000';
        const apiEndpoint = `${backendEndpoint}/api/pdf/convert-to-html`;
        
        // Build request body
        const requestBody = {
            template_name: templateName,
            textract_blocks: textractBlocks,
            page_width: pageWidth,
            page_height: pageHeight
        };
        
        // Add PDF S3 location for font detection if provided
        if (pdfS3Bucket && pdfS3Key) {
            requestBody.pdf_s3_bucket = pdfS3Bucket;
            requestBody.pdf_s3_key = pdfS3Key;
        }
        
        // Call the Flask backend API
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to convert PDF to HTML: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.success || !data.html) {
            throw new Error('Invalid response from HTML conversion service');
        }
        
        // Return success data
        return {
            success: true,
            html: data.html,
            templateName: data.template_name,
            blockCount: data.block_count,
            pageDimensions: data.page_dimensions,
            fontDetectionEnabled: data.font_detection_enabled || false
        };
    } catch (error) {
        console.error('Error converting PDF to HTML:', error);
        throw error;
    }
}
