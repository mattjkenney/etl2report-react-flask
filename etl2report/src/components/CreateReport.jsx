import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectSections } from '../store/dash/variableContainers';
import { updateField } from '../store/dash/variables';
import { selectAllBoxMappings } from '../store/dash/previewValues';
import { fetchAuthSession } from 'aws-amplify/auth';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import ManualInputPreview from './ManualInputPreview';

export default function CreateReport({ onBack }) {
    const dispatch = useDispatch();
    const { currentTemplate } = useSelector(state => state.templates);
    const { textractBlocks } = useSelector(state => state.pdfViewer);
    const variablesCache = useSelector(state => state.variables?.cache);
    const sections = useSelector(selectSections);
    const variableContainers = useSelector(state => state.variableContainers);
    const boxBindingsMap = useSelector(state => state.boxBindings?.bindings || {});
    
    // Get formatted values mapped to bounding boxes
    const boxToValueMap = useSelector(selectAllBoxMappings);
    
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);

    // Get all variables from all sections
    const allVariables = sections.flatMap((section) => {
        const variableIds = variableContainers?.[section.id]?.variableIds || [];
        return variableIds.map((id) => {
            const inputState = variablesCache?.[section.id]?.[currentTemplate]?.[id] || {};
            return {
                id,
                sectionId: section.id,
                sectionTitle: section.title,
                name: inputState.name || 'Unnamed variable',
                type: inputState.type || 'text',
                ...inputState
            };
        });
    });

    // Initialize form data based on variables
    useEffect(() => {
        if (allVariables && allVariables.length > 0) {
            setFormData(prev => {
                const newData = { ...prev };
                allVariables.forEach(variable => {
                    // Only initialize if the variable doesn't already have a value
                    if (!(variable.id in newData)) {
                        newData[variable.id] = '';
                    }
                });
                return newData;
            });
        }
    }, [currentTemplate, variablesCache]);

    const handleInputChange = (variableId, value) => {
        setFormData(prev => ({
            ...prev,
            [variableId]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            // Get authentication token
            const session = await fetchAuthSession();
            if (!session.tokens?.idToken) {
                throw new Error('No authentication token found');
            }
            const authToken = session.tokens.idToken.toString();

            // Build replacements array from boxToValueMap and textractBlocks
            const replacements = [];
            
            for (const [blockId, text] of Object.entries(boxToValueMap)) {
                // Find the corresponding block in textractBlocks
                const block = textractBlocks?.find(b => b.Id === blockId);
                
                if (block && block.Geometry && block.Geometry.BoundingBox) {
                    const bbox = block.Geometry.BoundingBox;
                    
                    // Convert normalized coordinates (0-1) to PDF points
                    // Assuming standard PDF page size of 612x792 points (8.5"x11" at 72 DPI)
                    const pageWidth = 612;
                    const pageHeight = 792;
                    
                    replacements.push({
                        x: bbox.Left * pageWidth,
                        y: bbox.Top * pageHeight,
                        width: bbox.Width * pageWidth,
                        height: bbox.Height * pageHeight,
                        text: text || ''
                    });
                }
            }

            if (replacements.length === 0) {
                throw new Error('No text replacements to apply. Please bind variables to bounding boxes first.');
            }

            // Get bucket and construct keys
            const bucket = import.meta.env.VITE_AWS_S3_BUCKET;
            if (!bucket) {
                throw new Error('S3 bucket not configured');
            }

            // Extract user ID from token for constructing S3 keys
            const userSub = session.tokens.idToken.payload.sub;
            
            // Construct source key (template location in S3)
            // Ensure template name doesn't have .pdf extension for the folder name
            const templateName = currentTemplate.replace('.pdf', '');
            // Ensure currentTemplate has .pdf extension for the file name
            const templateFileName = currentTemplate.endsWith('.pdf') ? currentTemplate : `${currentTemplate}.pdf`;
            const sourceKey = `users/${userSub}/templates/${templateName}/${templateFileName}`;
            
            // Construct destination key for the generated report
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputKey = `users/${userSub}/reports/${templateName}_${timestamp}.pdf`;

            // Call the replace_pdf_text API
            const backendDomain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:5000';
            const response = await fetch(`${backendDomain}/api/pdf/replace-text`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    template_id: sourceKey,
                    replacements: replacements,
                    page_number: 0,
                    source_bucket: bucket,
                    destination_bucket: bucket,
                    output_key: outputKey
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || 'Failed to generate report');
            }

            const result = await response.json();
            
            console.log('Report generated successfully:', result);
            setSuccessMessage(`Report generated successfully! File saved to: ${result.destination}`);
            
            // Optionally go back after successful submission
            // setTimeout(() => onBack(), 3000);
            
        } catch (err) {
            console.error('Error generating report:', err);
            setError(err.message || 'Failed to generate report. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleInequalityChange = (variableId, value) => {
        dispatch(updateField({ 
            sectionId: 'manuals', 
            templateId: currentTemplate, 
            itemId: variableId, 
            field: 'inequalityOperator', 
            value 
        }));
    };

    const renderInput = (variable) => {
        const section = sections.find(s => s.id === variable.sectionId);
        const sectionTitle = section ? section.title : 'Unknown Section';
        
        // Get all bounding boxes for this variable (boxBindingsMap is an object: {variableId: [blockId1, blockId2]})
        const boundBoxes = boxBindingsMap[variable.id] || [];
        const boxCount = boundBoxes.length;

        // If it's a manual input from the 'manuals' section, use ManualInputPreview
        if (variable.sectionId === 'manuals') {
            return (
                <div key={variable.id} className="space-y-2">
                    <ManualInputPreview id={variable.id} />
                </div>
            );
        }

        // For other types (tables, graphs, images), use simple input
        return (
            <div key={variable.id} className="space-y-2">                
                <input
                    id={`input-${variable.id}`}
                    type="text"
                    value={formData[variable.id] || ''}
                    onChange={(e) => handleInputChange(variable.id, e.target.value)}
                    className="w-full px-3 py-2 border border-theme-primary rounded-md bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                    placeholder={`Enter ${variable.name.toLowerCase()}`}
                />
            </div>
        );
    };

    // Group variables by section
    const groupedVariables = sections.map(section => ({
        section,
        variables: allVariables.filter(v => v.sectionId === section.id)
    })).filter(group => group.variables.length > 0);

    if (!currentTemplate) {
        return (
            <div className="text-theme-primary">
                <p>No template selected. Please select a template first.</p>
            </div>
        );
    }

    if (!allVariables || allVariables.length === 0) {
        return (
            <div className="text-theme-primary">
                <p>No variables defined for this template. Please edit the template to add variables first.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold text-theme-primary mb-2">
                    Create Report: {currentTemplate}
                </h3>
                <p className="text-sm text-theme-secondary opacity-70">
                    Fill in the values for each variable. These will be placed in the PDF at the locations you defined.
                </p>
            </div>

            {error && (
                <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md">
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded-md">
                    {successMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {groupedVariables.map(({ section, variables: sectionVars }) => (
                    <div key={section.id} className="space-y-3">
                        <h4 className="text-md font-medium text-theme-primary border-b border-theme-primary pb-1">
                            {section.title}
                        </h4>
                        <div className="space-y-3 pl-2">
                            {sectionVars.map(variable => renderInput(variable))}
                        </div>
                    </div>
                ))}

                <div className="flex space-x-3 pt-4 border-t border-theme-primary">
                    <Button
                        displayText="Cancel"
                        onClick={onBack}
                        variant="secondary"
                        size="medium"
                        type="button"
                        disabled={loading}
                        className="flex-1"
                    />
                    <Button
                        displayText={loading ? "Generating..." : "Generate Report"}
                        variant="primary"
                        size="medium"
                        type="submit"
                        disabled={loading}
                        className="flex-1"
                    />
                </div>
            </form>

            {loading && (
                <div className="flex justify-center py-4">
                    <LoadingSpinner size="medium" text="Generating your report..." />
                </div>
            )}
        </div>
    );
}
