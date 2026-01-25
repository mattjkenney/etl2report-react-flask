import { useSelector, useDispatch } from 'react-redux';
import { addVariable, clearCategory } from '../store/dash/variableContainers';
import { initializeItem } from '../store/dash/variables';
import { DragProvider } from '../contexts/DragContext';
import VariableContainer from './VariableContainer';
import ManualInputContent from './ManualInputContent';

export default function VariableSectionContent({ section, templateName }) {
    const dispatch = useDispatch();
    const inputIds = useSelector((state) => state.variableContainers?.[section.id]?.variableIds || []);

    const handleAddInput = () => {
        const id = `${section.id}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const index = inputIds.length + 1;
        dispatch(addVariable({ category: section.id, id }));
        dispatch(initializeItem({ 
            sectionId: section.id,
            templateId: templateName, 
            itemId: id,
            initialValues: { name: `${section.variablePrefix} ${index}` }
        }));
    };

    // Render the appropriate input content based on section id
    const renderInputContent = (id, index) => {
        if (section.id === 'manuals') {
            return <ManualInputContent id={id} index={index} templateName={templateName} />;
        }
        // Add other section types here as they are implemented
        return null;
    };

    return (
        <div className="p-4 bg-theme-primary text-theme-primary">
            <div className="flex items-center justify-between mb-3">
                <button
                    onClick={handleAddInput}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                    + Add Variable
                </button>
                {inputIds.length > 0 && (
                    <button
                        onClick={() => dispatch(clearCategory({ category: section.id }))}
                        className="text-sm text-red-600 hover:underline"
                    >
                        Clear All
                    </button>
                )}
            </div>
        
            <DragProvider category={section.id}>
                <div className="space-y-2">
                    {inputIds.map((id, index) => (
                        <VariableContainer
                            key={id}
                            id={id}
                            index={index + 1}
                            templateName={templateName}
                            category={section.id}
                        >
                            {renderInputContent(id, index + 1)}
                        </VariableContainer>
                    ))}
                </div>
            </DragProvider>
        </div>
    );
}
