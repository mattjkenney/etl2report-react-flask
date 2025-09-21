import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Document, Page, pdfjs } from 'react-pdf';
import { setCurrentPage, setTotalPages, setScale, setLoading, setError } from '../store/dash/pdfViewer';
import Button from './Button';

// Use local worker file with matching version to avoid CORS and version mismatch issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Import CSS for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export default function View() {
    const dispatch = useDispatch();
    const pdfViewer = useSelector((state) => state.pdfViewer);
    const { pdfUrl, currentPage, totalPages, scale, isLoading, error } = pdfViewer;
    
    const [numPages, setNumPages] = useState(null);

    const onDocumentLoadSuccess = ({ numPages }) => {
        console.log('PDF loaded successfully:', numPages, 'pages');
        setNumPages(numPages);
        dispatch(setTotalPages(numPages));
        dispatch(setCurrentPage(1));
        dispatch(setLoading(false));
    };

    const onDocumentLoadError = (error) => {
        console.error('Error loading PDF:', error);
        dispatch(setError(`Failed to load PDF: ${error.message || 'Unknown error'}`));
        dispatch(setLoading(false));
    };

    const onLoadStart = () => {
        console.log('Starting to load PDF:', pdfUrl);
        dispatch(setLoading(true));
        dispatch(setError(null));
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            dispatch(setCurrentPage(currentPage - 1));
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            dispatch(setCurrentPage(currentPage + 1));
        }
    };

    const zoomIn = () => {
        dispatch(setScale(Math.min(scale + 0.25, 3.0)));
    };

    const zoomOut = () => {
        dispatch(setScale(Math.max(scale - 0.25, 0.5)));
    };

    console.log('PDF.js version from react-pdf:', pdfjs.version);
    console.log('Worker URL:', pdfjs.GlobalWorkerOptions.workerSrc);

    if (!pdfUrl) {
        return (
            <div className="flex items-center justify-center h-full bg-theme-secondary border border-theme-primary rounded-lg p-8">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-theme-primary mb-2">No PDF Selected</h2>
                    <p className="text-theme-primary/70">Select a PDF file in the Actions panel to view it here.</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full bg-theme-secondary border border-theme-primary rounded-lg p-8">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-red-500 mb-2">Error Loading PDF</h2>
                    <p className="text-theme-primary/70 mb-4">{error}</p>
                    <div className="space-y-2">
                        <Button 
                            displayText="Retry Loading PDF"
                            onClick={() => {
                                dispatch(setError(null));
                                dispatch(setLoading(true));
                            }}
                            variant="primary"
                            size="medium"
                            className="block mx-auto"
                        />
                        <p className="text-xs text-theme-primary/50">
                            PDF.js v{pdfjs.version} | Worker: {pdfjs.GlobalWorkerOptions.workerSrc}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full bg-theme-secondary border border-theme-primary rounded-lg flex flex-col">
            {/* PDF Controls */}
            <div className="flex items-center justify-between p-4 border-b border-theme-primary">
                <div className="flex items-center space-x-4">
                    <Button
                        displayText="Previous"
                        onClick={goToPreviousPage}
                        disabled={currentPage <= 1 || isLoading}
                        variant="ghost"
                        size="small"
                    />
                    
                    <span className="text-theme-primary">
                        Page {currentPage} of {totalPages}
                    </span>
                    
                    <Button
                        displayText="Next"
                        onClick={goToNextPage}
                        disabled={currentPage >= totalPages || isLoading}
                        variant="ghost"
                        size="small"
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <Button
                        displayText="Zoom Out"
                        onClick={zoomOut}
                        disabled={scale <= 0.5 || isLoading}
                        variant="ghost"
                        size="small"
                    />
                    
                    <span className="text-theme-primary min-w-[60px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    
                    <Button
                        displayText="Zoom In"
                        onClick={zoomIn}
                        disabled={scale >= 3.0 || isLoading}
                        variant="ghost"
                        size="small"
                    />
                </div>
            </div>

            {/* PDF Document Container */}
            <div className="flex-1 overflow-auto p-4 bg-gray-100">
                <div className="flex justify-center">
                    <Document
                        file={pdfUrl}
                        onLoadStart={onLoadStart}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                            <div className="flex items-center justify-center p-8">
                                <div className="text-theme-primary">Loading PDF...</div>
                            </div>
                        }
                        error={
                            <div className="flex items-center justify-center p-8">
                                <div className="text-red-500">Failed to load PDF document</div>
                            </div>
                        }
                    >
                        {!isLoading && numPages && (
                            <Page
                                pageNumber={currentPage}
                                scale={scale}
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                                className="border border-gray-300 shadow-lg"
                                loading={
                                    <div className="flex items-center justify-center p-8">
                                        <div className="text-theme-primary">Rendering page...</div>
                                    </div>
                                }
                                error={
                                    <div className="flex items-center justify-center p-8">
                                        <div className="text-red-500">Failed to render page</div>
                                    </div>
                                }
                            />
                        )}
                    </Document>
                </div>
            </div>
        </div>
    );
}