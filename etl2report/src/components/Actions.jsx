import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { setReportFile } from '../store/dash/actions/newTemplate';
import Button from './Button';
import NewTemplate from './NewTemplate';

export default function Actions() {
    const dispatch = useDispatch();
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [showNewTemplate, setShowNewTemplate] = useState(false);

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
    };

    const isTemplateSelected = selectedTemplate !== '';

    // If showing new template form, render it instead of the main actions
    if (showNewTemplate) {
        return (
            <div className="space-y-4">
                <div className="flex items-center mb-4">
                    <Button
                        displayText="← Back"
                        onClick={handleBackToActions}
                        variant="secondary"
                        size="small"
                        type="button"
                    />
                </div>
                <NewTemplate />
            </div>
        );
    }

    return (
        <div className="bg-theme-secondary border border-theme-primary rounded-lg p-4 dashboard-content">
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