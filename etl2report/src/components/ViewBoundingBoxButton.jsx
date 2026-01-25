import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setHoveredBlockId, setSelectedBlockType, setSelectionMode } from '../store/dash/view';
import { setCurrentPage } from '../store/dash/pdfViewer';
import { selectBinding, removeBlockBinding } from '../store/dash/boxBindings';
import Button from './Button';
import RemoveButton from './RemoveButton';

export default function ViewBoundingBoxButton({ id }) {
    const dispatch = useDispatch();
    const templateName = useSelector((state) => state.templates.currentTemplate);
    const [enableSelection, setEnableSelection] = useState(false);
    const selectionMode = useSelector((state) => state.view.selectionMode);
    
    // Get block IDs from boxBindings store
    const blockIds = useSelector((state) => selectBinding(state, id));
    
    // Get all textract blocks
    const textractBlocks = useSelector((state) => state.pdfViewer.textractBlocks);
    
    // Look up the actual block objects from their IDs
    const blocks = useMemo(() => {
        if (!blockIds || blockIds.length === 0 || !textractBlocks) {
            return [];
        }
        return blockIds
            .map(blockId => textractBlocks.find(block => block.Id === blockId))
            .filter(block => block != null);
    }, [blockIds, textractBlocks]);

    // Update global selection mode when checkbox changes
    useEffect(() => {
        dispatch(setSelectionMode({
            enabled: enableSelection,
            targetInputId: enableSelection ? id : null,
            templateName: enableSelection ? templateName : null,
        }));
    }, [enableSelection, id, templateName, dispatch]);

    // Disable selection mode if another input enables it
    useEffect(() => {
        if (selectionMode?.enabled && selectionMode.targetInputId !== id) {
            setEnableSelection(false);
        }
    }, [selectionMode, id]);

    const handleHighlight = (block) => {
        if (block?.Page) {
            dispatch(setCurrentPage(block.Page));
        }
        if (block?.BlockType) {
            dispatch(setSelectedBlockType(block.BlockType));
        }
        dispatch(setHoveredBlockId(block?.Id));
        
        // Clear the hover after 3 seconds
        setTimeout(() => {
            dispatch(setHoveredBlockId(null));
        }, 3000);
    };

    const handleRemoveBinding = (blockId) => {
        dispatch(removeBlockBinding({ inputId: id, blockId }));
    };

    // Check if there are any valid blocks
    const hasValidBlocks = blocks.length > 0;

    return (
        <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={enableSelection}
                    onChange={(e) => setEnableSelection(e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
                <span>Enable block selection mode</span>
            </label>
            {hasValidBlocks ? (
                <div className="space-y-1">
                    {blocks.map((block, index) => (
                        <div key={block.Id} className="flex items-center gap-2">
                            <RemoveButton onClick={() => handleRemoveBinding(block.Id)} />
                            <Button
                                displayText={`View bounding box ${blocks.length > 1 ? `${index + 1}` : ''}`}
                                onClick={() => handleHighlight(block)}
                                variant="ghost"
                                size="small"
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <Button
                    displayText="No blocks bound"
                    variant="ghost"
                    size="small"
                    disabled={true}
                />
            )}
        </div>
    );
}
