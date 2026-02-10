import { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectSections } from '../store/dash/variableContainers';
import ViewBoundingBoxButton from './ViewBoundingBoxButton';
import VariableSectionContent from './VariableSectionContent';

export default function EditTemplate() {
    const [expandedSection, setExpandedSection] = useState(null);
    const [selectedInputForBinding, setSelectedInputForBinding] = useState('');
    const templateName = useSelector((state) => state.templates.currentTemplate);
    const sections = useSelector(selectSections);
    const variableContainers = useSelector((state) => state.variableContainers);
    const textractBlocks = useSelector((state) => state.pdfViewer?.textractBlocks);
    const variablesCache = useSelector((state) => state.variables?.cache);

    // Get all variables from all sections with their names and block IDs
    const allVariablesWithNames = sections.flatMap((section) => {
        const variableIds = variableContainers?.[section.id]?.variableIds || [];
        return variableIds.map((id) => {
            const inputState = variablesCache?.[section.id]?.[templateName]?.[id] || {};
            return {
                id,
                sectionId: section.id,
                sectionTitle: section.title,
                blockId: inputState.blockId,
                name: inputState.name || 'Unnamed variable'
            };
        });
    });

    const toggleSection = (sectionId) => {
        setExpandedSection(expandedSection === sectionId ? null : sectionId);
    };

    // Find the selected variable's blockId
    const selectedVariableData = allVariablesWithNames.find(v => v.id === selectedInputForBinding);
    const selectedBlockId = selectedVariableData?.blockId;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-theme-primary">
                Edit Template: {templateName}
            </h3>
            
            {/* Box Binding Section */}
            {allVariablesWithNames.length > 0 && (
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
                                {sections.map((section) => {
                                    const sectionVariables = allVariablesWithNames.filter(v => v.sectionId === section.id);
                                    if (sectionVariables.length === 0) return null;
                                    return (
                                        <optgroup key={section.id} label={section.title}>
                                            {sectionVariables.map((variable) => (
                                                <option key={variable.id} value={variable.id}>
                                                    {variable.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    );
                                })}
                            </select>
                        </div>
                        {selectedInputForBinding && (
                            <ViewBoundingBoxButton 
                                block={textractBlocks?.find(b => b.Id === selectedBlockId)} 
                                id={selectedInputForBinding}
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
                            <VariableSectionContent 
                                section={section}
                            />
                        )}
                    </div>
                ))}
                </div>
            </div>
        </div>
    );
}
