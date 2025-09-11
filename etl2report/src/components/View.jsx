import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source with fallback options
try {
    // Try to use the bundled worker first
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();
} catch (error) {
    console.warn('Failed to set worker from bundle, falling back to CDN:', error);
    // Fallback to CDN
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

export default function View({ file, onDocumentHeightChange }) {
    const canvasRef = useRef(null);
    const viewContainerRef = useRef(null);
    const [pdf, setPdf] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [scale, setScale] = useState(1.5);
    const [renderingPage, setRenderingPage] = useState(false);

    useEffect(() => {
        if (!file) {
            setPdf(null);
            setTotalPages(0);
            setCurrentPage(1);
            setError(null);
            // Reset document height when no file is selected
            if (onDocumentHeightChange) {
                onDocumentHeightChange('auto');
            }
            // Clear canvas when no file is selected
            if (canvasRef.current) {
                const context = canvasRef.current.getContext('2d');
                context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            }
            return;
        }

        loadPdf();
    }, [file, onDocumentHeightChange]);

    useEffect(() => {
        if (pdf && currentPage && !loading) {
            renderPage(currentPage);
        }
    }, [pdf, currentPage, scale]);

    // Calculate and report the actual document height based on canvas and UI elements
    const updateDocumentHeight = () => {
        if (!onDocumentHeightChange || !viewContainerRef.current) return;

        // Get the actual heights of UI elements
        const viewContainer = viewContainerRef.current;
        const headerHeight = 60; // Approximate height of title
        const fileInfoHeight = file ? 50 : 0; // File info section
        const controlsHeight = file ? 70 : 0; // Controls section
        const canvasHeight = canvasRef.current ? canvasRef.current.height : 0;
        const canvasPadding = file ? 32 : 0; // Padding around canvas (16px * 2)
        const errorLoadingHeight = (loading || renderingPage || error) ? 80 : 0;
        const noFileHeight = !file ? 80 : 0; // "No PDF file selected" message

        // Calculate total content height
        const totalContentHeight = headerHeight + fileInfoHeight + controlsHeight + 
                                 canvasHeight + canvasPadding + errorLoadingHeight + noFileHeight + 32; // Extra padding

        console.log('Height calculation:', {
            headerHeight,
            fileInfoHeight,
            controlsHeight,
            canvasHeight,
            canvasPadding,
            errorLoadingHeight,
            noFileHeight,
            totalContentHeight
        });

        onDocumentHeightChange(totalContentHeight);
    };

    // Update height when canvas or content changes
    useEffect(() => {
        updateDocumentHeight();
    }, [pdf, currentPage, scale, loading, renderingPage, error, file]);

    const loadPdf = async () => {
        try {
            setLoading(true);
            setError(null);
            setRenderingPage(false);
            
            console.log('Loading PDF file:', file.name, 'Size:', file.size, 'Type:', file.type);
            
            // Validate file size (limit to 50MB)
            if (file.size > 50 * 1024 * 1024) {
                throw new Error('PDF file is too large (max 50MB)');
            }
            
            // Convert file to ArrayBuffer
            const arrayBuffer = await file.arrayBuffer();
            console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
            
            // Load the PDF with optimized options for canvas rendering
            const loadingTask = pdfjsLib.getDocument({
                data: arrayBuffer,
                cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
                cMapPacked: true,
                enableXfa: true,
                standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
                useSystemFonts: false,
                disableFontFace: false,
                useWorkerFetch: false
            });
            
            // Add progress listener
            loadingTask.onProgress = (progress) => {
                console.log('PDF loading progress:', progress.loaded, '/', progress.total);
            };
            
            const pdfDoc = await loadingTask.promise;
            console.log('PDF loaded successfully, pages:', pdfDoc.numPages);
            
            setPdf(pdfDoc);
            setTotalPages(pdfDoc.numPages);
            setCurrentPage(1);
        } catch (err) {
            console.error('Error loading PDF:', err);
            let errorMessage = 'Failed to load PDF file';
            
            if (err.name === 'InvalidPDFException') {
                errorMessage = 'Invalid PDF file format';
            } else if (err.name === 'MissingPDFException') {
                errorMessage = 'PDF file is corrupted or missing';
            } else if (err.name === 'UnexpectedResponseException') {
                errorMessage = 'Unexpected response while loading PDF';
            } else if (err.name === 'PasswordException') {
                errorMessage = 'PDF file is password protected';
            } else if (err.message) {
                errorMessage = `PDF Error: ${err.message}`;
            }
            
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const renderPage = async (pageNumber) => {
        if (!pdf || !canvasRef.current || renderingPage) return;

        try {
            setRenderingPage(true);
            setError(null);
            console.log('Rendering page:', pageNumber, 'at scale:', scale);
            
            const page = await pdf.getPage(pageNumber);
            const viewport = page.getViewport({ scale });
            
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            // Set canvas dimensions to match viewport
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Clear the canvas before rendering
            context.clearRect(0, 0, canvas.width, canvas.height);
            
            // Set canvas background to white for better PDF visibility
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            const renderContext = {
                canvasContext: context,
                viewport: viewport,
                // Optimize rendering for better quality
                transform: null,
                enableWebGL: false
            };
            
            // Render the page to canvas
            const renderTask = page.render(renderContext);
            await renderTask.promise;
            
            console.log('Page', pageNumber, 'rendered successfully to canvas');
            
            // Update document height after rendering is complete
            setTimeout(updateDocumentHeight, 100);
        } catch (err) {
            console.error('Error rendering page:', err);
            setError(`Failed to render page ${pageNumber}: ${err.message}`);
        } finally {
            setRenderingPage(false);
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 1 && !renderingPage) {
            setCurrentPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages && !renderingPage) {
            setCurrentPage(currentPage + 1);
        }
    };

    const zoomIn = () => {
        if (!renderingPage) {
            setScale(Math.min(scale + 0.25, 3));
        }
    };

    const zoomOut = () => {
        if (!renderingPage) {
            setScale(Math.max(scale - 0.25, 0.5));
        }
    };

    const resetZoom = () => {
        if (!renderingPage) {
            setScale(1.5);
        }
    };

    const isDisabled = loading || renderingPage;

    return (
        <div 
            ref={viewContainerRef}
            className="bg-theme-secondary border border-theme-primary rounded-lg p-4 dashboard-content"
        >
            <h2 className="text-lg font-semibold text-theme-primary mb-4">View</h2>
            
            {!file && (
                <div className="text-center text-theme-primary opacity-70 py-8">
                    No PDF file selected
                </div>
            )}

            {file && (
                <>
                    {/* File Info */}
                    <div className="mb-4 p-2 bg-theme-primary/5 rounded text-sm text-theme-primary">
                        <strong>File:</strong> {file.name} ({Math.round(file.size / 1024)} KB)
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-4 p-3 bg-theme-primary/10 rounded-lg">
                        {/* Page Navigation */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={goToPreviousPage}
                                disabled={currentPage <= 1 || isDisabled}
                                className="px-3 py-1 bg-theme-primary text-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-primary/80 font-mono"
                            >
                                &lt;
                            </button>
                            <span className="text-theme-primary text-sm">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={goToNextPage}
                                disabled={currentPage >= totalPages || isDisabled}
                                className="px-3 py-1 bg-theme-primary text-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-primary/80 font-mono"
                            >
                                &gt;
                            </button>
                        </div>

                        {/* Zoom Controls */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={zoomOut}
                                disabled={isDisabled}
                                className="px-3 py-1 bg-theme-primary text-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-primary/80"
                            >
                                -
                            </button>
                            <button
                                onClick={resetZoom}
                                disabled={isDisabled}
                                className="px-3 py-1 bg-theme-primary text-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-primary/80 text-xs"
                            >
                                {Math.round(scale * 100)}%
                            </button>
                            <button
                                onClick={zoomIn}
                                disabled={isDisabled}
                                className="px-3 py-1 bg-theme-primary text-theme-secondary rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-theme-primary/80"
                            >
                                +
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {(loading || renderingPage) && (
                        <div className="text-center text-theme-primary py-8">
                            <div className="animate-pulse">
                                {loading ? 'Loading PDF...' : 'Rendering page...'}
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <div className="text-center py-8">
                            <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
                                <strong>Error:</strong> {error}
                                <div className="mt-2 text-sm text-red-600">
                                    Please check the browser console for more details.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PDF Canvas Container */}
                    <div className="border border-theme-primary/30 rounded bg-white shadow-inner">
                        <div className="p-4">
                            <canvas
                                ref={canvasRef}
                                className="block mx-auto shadow-lg"
                                style={{ 
                                    maxWidth: '100%',
                                    height: 'auto',
                                    border: '1px solid #e5e7eb'
                                }}
                            />
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}