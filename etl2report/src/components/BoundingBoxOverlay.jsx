import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectionMode } from '../store/dash/view';
import { addVariable } from '../store/dash/variableContainers';
import { initializeInput } from '../store/dash/manualInput';
import { setBinding } from '../store/dash/boxBindings';

/**
 * BoundingBoxOverlay Component
 * Renders bounding boxes from AWS Textract results over a PDF page
 * 
 * @param {Array} blocks - Textract blocks containing geometry information
 * @param {number} pageNumber - Current page number to display
 * @param {number} pageWidth - Width of the PDF page in pixels
 * @param {number} pageHeight - Height of the PDF page in pixels
 * @param {boolean} show - Toggle visibility of bounding boxes
 * @param {string} filterBlockType - Filter to show only specific block type ('ALL' shows all)
 */
export default function BoundingBoxOverlay({ blocks, pageNumber, pageWidth, pageHeight, show = true, filterBlockType = 'ALL' }) {
    const dispatch = useDispatch();
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [hoveredBlock, setHoveredBlock] = useState(null);
    const externalHoveredBlockId = useSelector((state) => state.view.hoveredBlockId);
    const selectionMode = useSelector((state) => state.view.selectionMode);

    if (!show || !blocks || blocks.length === 0 || !pageWidth || !pageHeight) {
        return null;
    }

    // Filter blocks for the current page
    const pageBlocks = blocks.filter(block => block.Page === pageNumber);
    
    // Apply block type filter
    const filteredBlocks = filterBlockType === 'ALL' 
        ? pageBlocks 
        : pageBlocks.filter(block => block.BlockType === filterBlockType);

    // Get CSS class for block type
    const getBlockTypeClass = (blockType) => {
        const typeMap = {
            'PAGE': 'page',
            'LINE': 'line',
            'WORD': 'word',
            'TABLE': 'table',
            'CELL': 'cell',
            'KEY_VALUE_SET': 'key-value-set',
            'SELECTION_ELEMENT': 'selection-element',
            'MERGED_CELL': 'merged-cell',
            'TITLE': 'title',
            'QUERY': 'query',
            'QUERY_RESULT': 'query-result',
            'SIGNATURE': 'signature',
            'TABLE_TITLE': 'table-title',
            'TABLE_FOOTER': 'table-footer',
            'LAYOUT_TEXT': 'layout-text',
            'LAYOUT_TITLE': 'layout-title',
            'LAYOUT_HEADER': 'layout-header',
            'LAYOUT_FOOTER': 'layout-footer',
            'LAYOUT_SECTION_HEADER': 'layout-section-header',
            'LAYOUT_PAGE_NUMBER': 'layout-page-number',
            'LAYOUT_LIST': 'layout-list',
            'LAYOUT_FIGURE': 'layout-figure',
            'LAYOUT_TABLE': 'layout-table',
            'LAYOUT_KEY_VALUE': 'layout-key-value'
        };
        return typeMap[blockType] || 'default';
    };

    // Render a single bounding box
    const renderBoundingBox = (block) => {
        if (!block.Geometry || !block.Geometry.BoundingBox) {
            return null;
        }

        const bbox = block.Geometry.BoundingBox;
        
        // Convert normalized coordinates (0-1) to pixel coordinates
        const left = bbox.Left * pageWidth;
        const top = bbox.Top * pageHeight;
        const width = bbox.Width * pageWidth;
        const height = bbox.Height * pageHeight;

        const isSelected = selectedBlock?.Id === block.Id;
        const isHovered = hoveredBlock?.Id === block.Id || externalHoveredBlockId === block.Id;
        const isDimmed = (hoveredBlock || externalHoveredBlockId) && !isHovered;

        const blockTypeClass = getBlockTypeClass(block.BlockType);
        const className = `bbox-box bbox-${blockTypeClass} ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${isHovered ? 'hovered' : ''}`;

        return (
            <div
                key={block.Id}
                className={className}
                style={{
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${width}px`,
                    height: `${height}px`,
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    
                    // If selection mode is enabled, update the target input's block ID
                    if (selectionMode?.enabled && selectionMode.targetInputId && selectionMode.templateName) {
                        // Bind the block to the target input in boxBindings store
                        dispatch(setBinding({ 
                            inputId: selectionMode.targetInputId,
                            blockId: block.Id 
                        }));

                        return;
                    }
                    
                    // Normal selection behavior - don't bind to any inputs, just give box info
                    setSelectedBlock(block);
                }}
                onMouseEnter={() => setHoveredBlock(block)}
                onMouseLeave={() => setHoveredBlock(null)}
                title={`${block.BlockType}${block.Text ? ': ' + block.Text : ''}`}
            />
        );
    };

    return (
        <>
            {/* Bounding boxes container */}
            <div
                className="bbox-overlay-container"
                style={{
                    width: `${pageWidth}px`,
                    height: `${pageHeight}px`,
                }}
                onClick={() => setSelectedBlock(null)}
            >
                {filteredBlocks.map(block => renderBoundingBox(block))}
            </div>

            {/* Selection mode indicator */}
            {selectionMode.enabled && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
                    Click on a bounding box to change the selected block
                </div>
            )}

            {/* Info panel for selected block */}
            {selectedBlock && (
                <div
                    className={`bbox-info-panel bbox-info-panel-${getBlockTypeClass(selectedBlock.BlockType)}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="bbox-info-header">
                        <h3 className="bbox-info-title">
                            {selectedBlock.BlockType}
                        </h3>
                        <button
                            className="bbox-info-close"
                            onClick={() => setSelectedBlock(null)}
                        >
                            ×
                        </button>
                    </div>
                    
                    {selectedBlock.Text && (
                        <div className="bbox-info-section">
                            <strong className="bbox-info-label">Text:</strong>
                            <p className="bbox-info-text">{selectedBlock.Text}</p>
                        </div>
                    )}
                    
                    {selectedBlock.Confidence && (
                        <div className="bbox-info-section">
                            <strong className="bbox-info-label">Confidence:</strong>
                            <span className="bbox-info-value">
                                {selectedBlock.Confidence.toFixed(2)}%
                            </span>
                        </div>
                    )}
                    
                    <div className="bbox-info-id">
                        <strong>ID:</strong> {selectedBlock.Id.substring(0, 20)}...
                    </div>
                </div>
            )}
        </>
    );
}
