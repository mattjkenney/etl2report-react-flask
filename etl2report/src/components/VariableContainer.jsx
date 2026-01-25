import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { removeVariable } from '../store/dash/variableContainers';
import { removeInput } from '../store/dash/manualInput';
import { removeBinding } from '../store/dash/boxBindings';
import RemoveButton from './RemoveButton';

export default function VariableContainer({ 
    id, 
    index, 
    name, 
    onNameChange,
    onDragStart, 
    onDragOver, 
    onDrop, 
    isDragging,
    children,
    defaultExpanded = false,
    category = 'manuals', // Add category prop with default
    templateName = '', // Add templateName prop for cleaning up input data
}) {
    const dispatch = useDispatch();
    const [localName, setLocalName] = useState(name);
    const [isNameFocused, setIsNameFocused] = useState(false);
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    const handleNameChange = (e) => {
        const newName = e.target.value;
        setLocalName(newName);
        if (onNameChange) {
            onNameChange(newName);
        }
    };

    const handleRemove = () => {
        dispatch(removeVariable({ category, id }));
        // Also remove from the data store if it's a manual input
        if (category === 'manuals' && templateName) {
            dispatch(removeInput({ templateId: templateName, inputId: id }));
        }
    };

    return (
        <div 
            draggable
            onDragStart={(e) => onDragStart(e, index - 1)}
            onDragOver={(e) => onDragOver(e, index - 1)}
            onDrop={(e) => onDrop(e, index - 1)}
            className={`bg-theme-secondary p-3 rounded border border-theme-primary hover:border-theme-secondary flex items-start gap-3 transition-colors cursor-move ${isDragging ? 'opacity-50' : ''}`}
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
