import { useDispatch } from 'react-redux';
import { setHoveredBlockId, setSelectedBlockType } from '../store/dash/view';
import { setCurrentPage } from '../store/dash/pdfViewer';
import Button from './Button';

export default function ViewBoundingBoxButton({ block, id }) {
    const dispatch = useDispatch();

    const handleHighlight = () => {
        if (block?.Page) {
            dispatch(setCurrentPage(block.Page));
        }
        if (block?.BlockType) {
            dispatch(setSelectedBlockType(block.BlockType));
        }
        dispatch(setHoveredBlockId(id));
        
        // Clear the hover after 3 seconds
        setTimeout(() => {
            dispatch(setHoveredBlockId(null));
        }, 3000);
    };

    return (
        <Button
            displayText="View bounding box"
            onClick={handleHighlight}
            variant="ghost"
            size="small"
        />
    );
}
