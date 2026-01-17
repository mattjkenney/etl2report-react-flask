import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearBoundingBoxIds } from '../store/dash/view';
import ManualInput from './ManualInput';

export default function EditTemplate({ templateName, onBack }) {
    const dispatch = useDispatch();
    const [expandedSection, setExpandedSection] = useState(null);
    const { selectedBoundingBoxIds } = useSelector((state) => state.view);

    const sections = [
        { id: 'manual', title: 'Manual' },
        { id: 'tables', title: 'Tables' },
        { id: 'graphs', title: 'Graphs' },
        { id: 'images', title: 'Images' }
    ];

    const toggleSection = (sectionId) => {
        setExpandedSection(expandedSection === sectionId ? null : sectionId);
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-theme-primary">
                Edit Template: {templateName}
            </h3>
            
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
                                            <p className="font-medium">Selected variables:</p>
                                            {selectedBoundingBoxIds.length > 0 && (
                                                <button
                                                    onClick={() => dispatch(clearBoundingBoxIds())}
                                                    className="text-sm text-red-600 hover:underline"
                                                >
                                                    Clear All
                                                </button>
                                            )}
                                        </div>
                                        {selectedBoundingBoxIds.length === 0 ? (
                                            <p className="text-theme-secondary italic">
                                                No variables selected. Click on bounding boxes in the PDF viewer to add them.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedBoundingBoxIds.map((id, index) => (
                                                    <ManualInput 
                                                        key={id}
                                                        id={id}
                                                        index={index + 1}
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
