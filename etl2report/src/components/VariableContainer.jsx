import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { removeBoundingBoxId } from '../store/dash/view';

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
    defaultExpanded = false
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
        dispatch(removeBoundingBoxId(id));
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
                        className={`flex-1 text-base font-semibold bg-transparent text-theme-primary px-0 focus:outline-none ${isNameFocused ? 'italic' : ''}`}
                        style={{ border: 'none', boxShadow: 'none' }}
                    />
                </div>
                {isExpanded && children}
            </div>
            <button
                onClick={handleRemove}
                className="flex-shrink-0 text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                title="Remove"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
