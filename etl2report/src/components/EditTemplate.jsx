import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { addVariable, removeVariable, reorderVariables, clearCategory } from '../store/dash/variableContainers';
import { initializeInput, updateField, selectInputState } from '../store/dash/manualInput';
import ManualInput from './ManualInput';
import ViewBoundingBoxButton from './ViewBoundingBoxButton';

export default function EditTemplate({ templateName, onBack }) {
    const dispatch = useDispatch();
    const [expandedSection, setExpandedSection] = useState(null);
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [selectedInputForBinding, setSelectedInputForBinding] = useState('');
    const manualIds = useSelector((state) => state.variableContainers?.manuals || []);
    const textractBlocks = useSelector((state) => state.pdfViewer?.textractBlocks);
    const manualInputCache = useSelector((state) => state.manualInput?.cache);

    // Get all manual inputs with their names and block IDs
    const manualInputsWithNames = (manualIds || []).map((id) => {
        const inputState = manualInputCache?.[templateName]?.[id] || {};
        return {
            id,
            blockId: inputState.blockId,
            name: inputState.name || 'Unnamed input'
        };
    });

    const sections = [
        { id: 'manual', title: 'Manual' },
        { id: 'tables', title: 'Tables' },
        { id: 'graphs', title: 'Graphs' },
        { id: 'images', title: 'Images' }
    ];

    const toggleSection = (sectionId) => {
        setExpandedSection(expandedSection === sectionId ? null : sectionId);
    };

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            dispatch(reorderVariables({ category: 'manuals', fromIndex: draggedIndex, toIndex: dropIndex }));
        }
        setDraggedIndex(null);
    };

    // Helper to add a new manual input
    const handleAddManualInput = () => {
        const id = `manual-input-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        dispatch(addVariable({ category: 'manuals', id }));
        dispatch(initializeInput({ templateId: templateName, inputId: id }));
    };

    // Find the selected input's blockId
    const selectedInputData = manualInputsWithNames.find(inp => inp.id === selectedInputForBinding);
    const selectedBlockId = selectedInputData?.blockId;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-theme-primary">
                Edit Template: {templateName}
            </h3>
            
            {/* Box Binding Section */}
            {manualIds.length > 0 && (
                <div className="border border-theme-primary rounded-lg p-4 bg-theme-secondary">
                    <h4 className="text-md font-semibold text-theme-primary mb-3">Box Binding</h4>
                    <div className="space-y-3">
                        <div className="form-field">
                            <label className="form-label">Select Variable</label>
                            <select
                                value={selectedInputForBinding}
                                onChange={(e) => setSelectedInputForBinding(e.target.value)}
                                className="form-input"
                            >
                                <option value="">-- Select a variable --</option>
                                {manualInputsWithNames.map((input) => (
                                    <option key={input.id} value={input.id}>
                                        {input.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {selectedInputForBinding && (
                            <ViewBoundingBoxButton 
                                block={textractBlocks?.find(b => b.Id === selectedBlockId)} 
                                id={selectedInputForBinding}
                                templateName={templateName}
                            />
                        )}
                    </div>
                </div>
            )}
            
            {/* Variables Section */}
            <div>
                <h4 className="text-md font-semibold text-theme-primary mb-2">Variables</h4>
                <div className="border border-theme-primary rounded-lg overflow-hidden">
                {sections.map((section) => (
                    <div key={section.id} className="border-b border-theme-primary last:border-b-0">
                        <button
                            onClick={() => toggleSection(section.id)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-theme-secondary hover:bg-theme-tertiary transition-colors"
                        >
                            <span className="font-medium text-theme-primary">{section.title}</span>
                            <svg
                                className={`w-5 h-5 text-theme-primary transition-transform ${
                                    expandedSection === section.id ? 'rotate-180' : ''
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {expandedSection === section.id && (
                            <div className="p-4 bg-theme-primary text-theme-primary">
                                {section.id === 'manual' ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <button
                                                onClick={handleAddManualInput}
                                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                                            >
                                                + Add Manual Input
                                            </button>
                                            {manualIds.length > 0 && (
                                                <button
                                                    onClick={() => dispatch(clearCategory({ category: 'manuals' }))}
                                                    className="text-sm text-red-600 hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                        {manualIds.length === 0 ? (
                                            <p className="text-theme-secondary italic">
                                                No variables selected. Click on bounding boxes in the PDF viewer to add them.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {manualIds.map((id, index) => (
                                                    <ManualInput 
                                                        key={id}
                                                        id={id}
                                                        index={index + 1}
                                                        templateName={templateName}
                                                        onDragStart={handleDragStart}
                                                        onDragOver={handleDragOver}
                                                        onDrop={handleDrop}
                                                        isDragging={draggedIndex === index}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p>Content for {section.title} will be implemented here.</p>
                                )}
                            </div>
                        )}
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
}
