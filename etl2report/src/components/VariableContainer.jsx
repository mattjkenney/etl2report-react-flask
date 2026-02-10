import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { removeVariable } from '../store/dash/variableContainers';
import { removeItem, updateField, selectItemState } from '../store/dash/variables';
import { useDrag } from '../contexts/DragContext';
import RemoveButton from './RemoveButton';

export default function VariableContainer({ 
    id, 
    index, 
    children,
    category = 'manual',
    defaultExpanded = false,
}) {
    const dispatch = useDispatch();
    const templateName = useSelector((state) => state.templates.currentTemplate);
    const { handleDragStart, handleDrop, isDragging } = useDrag();
    
    // Fetch name from Redux based on category
    const inputState = useSelector((state) => selectItemState(state, category, templateName, id));
    const name = inputState?.name || `Variable ${index}`;
    
    const [localName, setLocalName] = useState(name);
    const [isNameFocused, setIsNameFocused] = useState(false);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Sync localName when Redux name changes
    useEffect(() => {
        setLocalName(name);
    }, [name]);

    const handleNameChange = (e) => {
        const newName = e.target.value;
        setLocalName(newName);
        // Update Redux based on category
        dispatch(updateField({ sectionId: category, templateId: templateName, itemId: id, field: 'name', value: newName }));
    };

    const handleRemove = () => {
        dispatch(removeVariable({ category, id }));
        // Also remove from the data store
        if (templateName) {
            dispatch(removeItem({ sectionId: category, templateId: templateName, itemId: id }));
        }
    };

    const onDragStart = (e) => {
        handleDragStart(index - 1);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (e) => {
        e.preventDefault();
        handleDrop(index - 1);
    };

    return (
        <div 
            draggable
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className={`bg-theme-secondary p-3 rounded border border-theme-primary hover:border-theme-secondary flex items-start gap-3 transition-colors cursor-move ${isDragging(index - 1) ? 'opacity-50' : ''}`}
        >
            <div className="flex-grow space-y-3">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-theme-primary hover:bg-theme-tertiary rounded transition-colors"
                        style={{ minWidth: '24px' }}
                    >
                        {isExpanded ? '-' : '+'}
                    </button>
                    <input
                        type="text"
                        value={localName}
                        onChange={handleNameChange}
                        onFocus={() => setIsNameFocused(true)}
                        onBlur={() => setIsNameFocused(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                setIsNameFocused(false);
                                e.target.blur();
                            }
                        }}
                        className={`flex-1 text-base font-semibold bg-transparent text-theme-primary px-0 focus:outline-none ${isNameFocused ? 'italic' : ''}`}
                        style={{ border: 'none', boxShadow: 'none' }}
                    />
                </div>
                {isExpanded && children}
            </div>
            <RemoveButton onClick={handleRemove} />
        </div>
    );
}
