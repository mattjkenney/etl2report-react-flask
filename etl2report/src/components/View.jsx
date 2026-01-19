import { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Document, Page, pdfjs } from 'react-pdf';
import { setCurrentPage, setTotalPages, setScale, setLoading, setError, setShowBoundingBoxes } from '../store/dash/pdfViewer';
import { setSelectedBlockType } from '../store/dash/view';
import Button from './Button';
import BoundingBoxOverlay from './BoundingBoxOverlay';
import LoadingSpinner from './LoadingSpinner';

// Use local worker file with matching version to avoid CORS and version mismatch issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Import CSS for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export default function View() {
    const dispatch = useDispatch();
    const pdfViewer = useSelector((state) => state.pdfViewer);
    const { pdfUrl, currentPage, totalPages, scale, isLoading, error, textractBlocks, showBoundingBoxes } = pdfViewer;
    const { loadingTextract } = useSelector((state) => state.templates);
    const selectedBlockType = useSelector((state) => state.view.selectedBlockType);
    
    const [numPages, setNumPages] = useState(null);
    const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
    const pageRef = useRef(null);

    const blockTypes = [
        { type: 'ALL', label: 'All', color: 'gray' },
        { type: 'PAGE', label: 'Page', color: 'slate' },
        { type: 'LINE', label: 'Line', color: 'blue' },
        { type: 'WORD', label: 'Word', color: 'green' },
        { type: 'TABLE', label: 'Table', color: 'purple' },
        { type: 'CELL', label: 'Cell', color: 'orange' },
        { type: 'MERGED_CELL', label: 'Merged Cell', color: 'amber' },
        { type: 'KEY_VALUE_SET', label: 'Key-Value', color: 'pink' },
        { type: 'SELECTION_ELEMENT', label: 'Selection', color: 'cyan' },
        { type: 'TITLE', label: 'Title', color: 'indigo' },
        { type: 'QUERY', label: 'Query', color: 'teal' },
        { type: 'QUERY_RESULT', label: 'Query Result', color: 'emerald' },
        { type: 'SIGNATURE', label: 'Signature', color: 'rose' },
        { type: 'TABLE_TITLE', label: 'Table Title', color: 'violet' },
        { type: 'TABLE_FOOTER', label: 'Table Footer', color: 'fuchsia' },
        { type: 'LAYOUT_TEXT', label: 'Layout Text', color: 'lime' },
        { type: 'LAYOUT_TITLE', label: 'Layout Title', color: 'sky' },
        { type: 'LAYOUT_HEADER', label: 'Layout Header', color: 'red' },
        { type: 'LAYOUT_FOOTER', label: 'Layout Footer', color: 'yellow' },
        { type: 'LAYOUT_SECTION_HEADER', label: 'Section Header', color: 'emerald' },
        { type: 'LAYOUT_PAGE_NUMBER', label: 'Page Number', color: 'blue' },
        { type: 'LAYOUT_LIST', label: 'Layout List', color: 'green' },
        { type: 'LAYOUT_FIGURE', label: 'Layout Figure', color: 'purple' },
        { type: 'LAYOUT_TABLE', label: 'Layout Table', color: 'orange' },
        { type: 'LAYOUT_KEY_VALUE', label: 'Layout K-V', color: 'pink' },
    ];

    // Get available block types from textractBlocks
    const availableBlockTypes = textractBlocks 
        ? ['ALL', ...new Set(textractBlocks.map(block => block.BlockType))]
        : ['ALL'];
    
    // Filter to only show buttons for available block types
    const visibleBlockTypes = blockTypes.filter(bt => availableBlockTypes.includes(bt.type));

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

    const onPageLoadSuccess = (page) => {
        const { width, height } = page;
        setPageDimensions({ width, height });
    };

    const toggleBoundingBoxes = () => {
        dispatch(setShowBoundingBoxes(!showBoundingBoxes));
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
                    {(textractBlocks || loadingTextract) && (
                        loadingTextract ? (
                            <div className="px-3 py-2">
                                <LoadingSpinner size="small" text="Loading..." />
                            </div>
                        ) : (
                            <Button
                                displayText={showBoundingBoxes ? "Hide Boxes" : "Show Boxes"}
                                onClick={toggleBoundingBoxes}
                                variant="ghost"
                                size="small"
                            />
                        )
                    )}
                    
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

            {/* PDF Document Container with Block Type Filter */}
            <div className="flex-1 flex overflow-hidden">
                {/* Block Type Filter Ribbon */}
                {textractBlocks && showBoundingBoxes && (
                    <div className="w-24 bg-theme-secondary border-r border-theme-primary p-2 overflow-y-auto">
                        <div className="space-y-2">
                            {visibleBlockTypes.map(({ type, label, color }) => (
                                <button
                                    key={type}
                                    onClick={() => dispatch(setSelectedBlockType(type))}
                                    className={`w-full px-2 py-2 text-xs rounded transition-all ${
                                        selectedBlockType === type
                                            ? `bg-${color}-500 text-white font-semibold`
                                            : 'bg-theme-tertiary text-theme-primary hover:bg-theme-border'
                                    }`}
                                    title={`Filter ${label} blocks`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {/* PDF Viewer */}
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
                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                <Page
                                    ref={pageRef}
                                    pageNumber={currentPage}
                                    scale={scale}
                                    renderTextLayer={true}
                                    renderAnnotationLayer={true}
                                    className="border border-gray-300 shadow-lg"
                                    onLoadSuccess={onPageLoadSuccess}
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
                                {/* Render bounding box overlay */}
                                {textractBlocks && pageDimensions.width > 0 && (
                                    <BoundingBoxOverlay
                                        blocks={textractBlocks}
                                        pageNumber={currentPage}
                                        pageWidth={pageDimensions.width}
                                        pageHeight={pageDimensions.height}
                                        show={showBoundingBoxes}
                                        filterBlockType={selectedBlockType}
                                    />
                                )}
                            </div>
                        )}
                    </Document>
                    </div>
                </div>
            </div>
        </div>
    );
}