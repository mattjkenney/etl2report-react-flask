import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setReportFile } from '../store/dash/actions/newTemplate';
import { resetPdfViewer } from '../store/dash/pdfViewer';
import { setActionsDefaultHeight } from '../store/dash/sizing';
import Button from './Button';
import NewTemplate from './NewTemplate';

export default function Actions() {
    const dispatch = useDispatch();
    const { actionsDefaultHeight } = useSelector(state => state.sizing);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [showNewTemplate, setShowNewTemplate] = useState(false);

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
        setSelectedTemplate(e.target.value);
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

    const isTemplateSelected = selectedTemplate !== '';

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
                    >
                        <option value="">Choose a template...</option>
                        <option value="template1">Template 1</option>
                        <option value="template2">Template 2</option>
                        <option value="template3">Template 3</option>
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
                        onClick={() => alert('Edit action triggered')}
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