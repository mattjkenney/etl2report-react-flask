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
        
        // Log token details for debugging (don't log in production)
        // console.log('Auth Debug:', {
        //     tokenExists: !!jwtToken,
        //     tokenLength: jwtToken.length,
        //     tokenStart: jwtToken.substring(0, 10) + '...',
        //     sub: token.payload.sub,
        //     idtoken: jwtToken
        // });

        return {
            token: jwtToken,
            sub: token.payload.sub
        };
    } catch (error) {
        // console.error('Error getting auth session:', error);
        throw new Error('Failed to get authentication token: ' + error.message);
    }
}

export async function uploadFile(file, bucketName, key = null, description = '') {
    try {
        // Get the auth session details
        const { token, sub } = await getAuthSession();
        
        // Validate required parameters
        if (!token) {
            throw new Error('Authentication token is missing');
        }
        if (!sub) {
            throw new Error('User ID (sub) is missing from token');
        }
        if (!file) {
            throw new Error('File is required');
        }
        if (!bucketName) {
            throw new Error('Bucket name is required');
        }
        
        // Verify we have an API endpoint
        const apiEndpoint = import.meta.env.VITE_AWS_S3_PUT_API_ENDPOINT;
        if (!apiEndpoint) {
            throw new Error('API endpoint is not configured. Please check your environment variables.');
        }

        // Ensure key ends with .pdf if provided
        let finalKey = key || file.name;
        let S3Key_prefix = '';
        if (key && !key.toLowerCase().endsWith('.pdf')) {
            finalKey = `${key}.pdf`;
            S3Key_prefix = key;
        } else {
            S3Key_prefix = key.slice(0, -4); // Remove .pdf
        }

        // Use provided key or construct default S3 key
        const s3Key = `${sub}/templates/${S3Key_prefix}/${finalKey}`;

        // console.log('Requesting pre-signed URL:', {
        //     fileSize: file.size,
        //     fileName: file.name,
        //     contentType: file.type,
        //     key: s3Key,
        //     bucket: bucketName,
        //     endpoint: apiEndpoint,
        //     metadata: metadata
        // });

        // Step 1: Get pre-signed URL from backend
        const presignedUrlResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucket: bucketName,
                key: s3Key,
                contentType: file.type,
                description: description
            })
        });

        if (!presignedUrlResponse.ok) {
            const errorText = await presignedUrlResponse.text();
            throw new Error(`Failed to get pre-signed URL: ${presignedUrlResponse.status}. ${errorText}`);
        }

        const { presignedUrl } = await presignedUrlResponse.json();
        
        if (!presignedUrl) {
            throw new Error('No pre-signed URL returned from server');
        }

        // console.log('Uploading directly to S3 with pre-signed URL');

        // Step 2: Upload directly to S3 using pre-signed URL
        const uploadResponse = await fetch(presignedUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': file.type
            },
            body: file
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`S3 upload failed: ${uploadResponse.status}. ${errorText}`);
        }

        // console.log('File uploaded successfully to S3');

        // Return success data
        return {
            success: true,
            message: 'File uploaded successfully',
            bucket: bucketName,
            key: s3Key,
            fileName: file.name
        };
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
}

export async function startTextractAnalysis(bucket, key, outputBucket, outputKeyPrefix = null) {
    try {
        // Get the auth session details
        const { token, sub } = await getAuthSession();
        
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
        
        // Set default outputKeyPrefix if not provided
        // Extract template name from key (format: user_id/template_name/template_name.pdf)
        let finalOutputKeyPrefix = outputKeyPrefix;
        if (!finalOutputKeyPrefix) {
            const keyParts = key.split('/');
            // Store textract output under the template folder: user_id/template_name/textract-output
            const templateName = keyParts[keyParts.length - 1].slice(0, -4); // Remove .pdf
            finalOutputKeyPrefix = `${sub}/templates/${templateName}/textract-output`;
        }
        
        // Verify we have an API endpoint
        const apiEndpoint = import.meta.env.VITE_AWS_TEXTRACT_START_DOCUMENT_ANALYSIS_API_ENDPOINT;
        if (!apiEndpoint) {
            throw new Error('Textract API endpoint is not configured. Please check your environment variables.');
        }

        // Call the API Gateway endpoint
        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucket: bucket,
                key: key,
                outputBucket: outputBucket,
                outputKeyPrefix: finalOutputKeyPrefix
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to start Textract analysis: ${response.status}`);
        }

        const data = await response.json();
        
        if (!data.jobId) {
            throw new Error('No job ID returned from Textract service');
        }

        // Return success data
        return {
            success: true,
            jobId: data.jobId,
            status: data.status,
            outputLocation: data.outputLocation
        };
    } catch (error) {
        console.error('Error starting Textract analysis:', error);
        throw error;
    }
}