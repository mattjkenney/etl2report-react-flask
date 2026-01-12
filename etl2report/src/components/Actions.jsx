import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setReportFile } from '../store/dash/actions/newTemplate';
import { resetPdfViewer, setPdfUrl, setTextractBlocks, setLoading } from '../store/dash/pdfViewer';
import { setActionsDefaultHeight } from '../store/dash/sizing';
import { fetchTemplates, fetchTemplatePdf, fetchTemplateTextract } from '../store/dash/templates';
import Button from './Button';
import NewTemplate from './NewTemplate';
import EditTemplate from './EditTemplate';

export default function Actions() {
    const dispatch = useDispatch();
    const { actionsDefaultHeight } = useSelector(state => state.sizing);
    const { templates, loading, error } = useSelector(state => state.templates);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [showNewTemplate, setShowNewTemplate] = useState(false);
    const [showEditTemplate, setShowEditTemplate] = useState(false);

    // Fetch templates on component mount
    useEffect(() => {
        const bucket = import.meta.env.VITE_AWS_S3_BUCKET;
        if (bucket) {
            dispatch(fetchTemplates(bucket, 'templates'));
        }
    }, [dispatch]);

    // Update default height based on window size - matches dashboard-container height
    useEffect(() => {
        const updateHeight = () => {
            // Use the exact same calculation as .dashboard-container class: calc(100vh - 160px)
            const newHeight = window.innerHeight - 160;
            dispatch(setActionsDefaultHeight(newHeight));
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, [dispatch]);

    const handleTemplateChange = (e) => {
        const templateName = e.target.value;
        setSelectedTemplate(templateName);
        
        // If a template is selected, load its PDF
        if (templateName) {
            loadTemplatePdf(templateName);
        } else {
            // Clear the PDF viewer if no template selected
            dispatch(resetPdfViewer());
        }
    };
    
    const loadTemplatePdf = async (templateName) => {
        try {
            dispatch(setLoading(true));
            const pdfUrl = await dispatch(fetchTemplatePdf(templateName));
            dispatch(setPdfUrl(pdfUrl));
        } catch (error) {
            console.error('Failed to load template PDF:', error);
            // Error is already handled in the thunk, just log here
        }
    };
    
    const handleEditClick = async () => {
        if (!selectedTemplate) return;
        
        // Show the EditTemplate component first
        setShowEditTemplate(true);
        
        try {
            const blocks = await dispatch(fetchTemplateTextract(selectedTemplate));
            dispatch(setTextractBlocks(blocks));
            // You might want to show a success message or notification here
        } catch (error) {
            console.error('Failed to load Textract results:', error);
            alert('Failed to load template analysis results. Please try again.');
        }
    };

    const handleNewClick = () => {
        setShowNewTemplate(true);
    };

    const handleBackToActions = () => {
        setShowNewTemplate(false);
        // Clear the file metadata when going back
        dispatch(setReportFile(null));
        // Clear the PDF viewer
        dispatch(resetPdfViewer());
    };
    
    const handleBackFromEdit = () => {
        setShowEditTemplate(false);
        // Clear the PDF viewer
        dispatch(resetPdfViewer());
    };

    const isTemplateSelected = selectedTemplate !== '';

    // If showing edit template form, render it instead of the main actions
    if (showEditTemplate) {
        return (
            <div 
                className="bg-theme-secondary border border-theme-primary rounded-lg dashboard-content overflow-y-auto"
                style={{ maxHeight: `${actionsDefaultHeight}px` }}
            >
                <div className="p-4">
                    <div className="flex items-center mb-4">
                        <Button
                            displayText="← Back"
                            onClick={handleBackFromEdit}
                            variant="secondary"
                            size="small"
                            type="button"
                        />
                    </div>
                    <div className="space-y-4">
                        <EditTemplate 
                            templateName={selectedTemplate}
                            onBack={handleBackFromEdit}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // If showing new template form, render it instead of the main actions
    if (showNewTemplate) {
        return (
            <div 
                className="bg-theme-secondary border border-theme-primary rounded-lg dashboard-content overflow-y-auto"
                style={{ maxHeight: `${actionsDefaultHeight}px` }}
            >
                <div className="p-4">
                    <div className="flex items-center mb-4">
                        <Button
                            displayText="← Back"
                            onClick={handleBackToActions}
                            variant="secondary"
                            size="small"
                            type="button"
                        />
                    </div>
                    <div className="space-y-4">
                        <NewTemplate />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="bg-theme-secondary border border-theme-primary rounded-lg p-4 dashboard-content"
            style={{ maxHeight: `${actionsDefaultHeight}px` }}
        >
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Actions</h2>

            <form className="space-y-4">
                <div>
                    <label
                        htmlFor="template-select"
                        className="block text-sm font-medium text-theme-primary mb-2"
                    >
                        Select a Template
                    </label>
                    <select
                        id="template-select"
                        name="template"
                        value={selectedTemplate}
                        onChange={handleTemplateChange}
                        className="w-full px-3 py-2 border border-theme-primary rounded-md bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent mb-4"
                        disabled={loading}
                    >
                        <option value="">
                            {loading ? 'Loading templates...' : error ? 'Error loading templates' : 'Choose a template...'}
                        </option>
                        {templates.map((template) => (
                            <option key={template} value={template}>
                                {template}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="space-y-3">
                    <Button
                        displayText="New"
                        onClick={handleNewClick}
                        variant='secondary'
                        size='small'
                        className='w-full'
                        type='button'
                    />
                    <Button
                        displayText="Edit"
                        onClick={handleEditClick}
                        variant='secondary'
                        size='small'
                        className='w-full'
                        type='button'
                        disabled={!isTemplateSelected}
                    />
                    <Button
                        displayText="Create Report"
                        onClick={() => alert('Create Report action triggered')}
                        variant='primary'
                        size='small'
                        className='w-full'
                        type='submit'
                        disabled={!isTemplateSelected}
                    />
                </div>
            </form>
        </div>
    )
}