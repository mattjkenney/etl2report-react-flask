import { useSelector, useDispatch } from 'react-redux';
import { useState } from 'react';
import { setReportFile, updateFormField } from '../store/dash/actions/newTemplate';
import Button from './Button';

export default function NewTemplate() {
    const dispatch = useDispatch();
    const formData = useSelector((state) => state.newTemplate);
    
    // Keep the actual File object in local state
    const [actualFile, setActualFile] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        console.log('File selected in NewTemplate:', file ? file.name : 'null', file?.type);
        
        if (file) {
            // Validate file type
            if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
                alert('Please select a PDF file');
                e.target.value = ''; // Clear the input
                return;
            }
            
            // Validate file size (50MB limit)
            if (file.size > 50 * 1024 * 1024) {
                alert('PDF file is too large (max 50MB)');
                e.target.value = ''; // Clear the input
                return;
            }
            
            console.log('Storing file metadata in Redux store:', file.name);
            // Store the actual File object locally
            setActualFile(file);
            
            // Extract only serializable metadata for Redux
            const fileMetadata = {
                name: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };
            
            // Dispatch only serializable metadata
            dispatch(setReportFile(fileMetadata));
        } else {
            setActualFile(null);
            dispatch(setReportFile(null));
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        dispatch(updateFormField({ name, value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Basic validation for required field
        if (!formData.reportFile || !actualFile) {
            alert('Please select a report file');
            return;
        }

        // Handle form submission logic here with the actual file
        console.log('Form submitted:', { 
            ...formData, 
            actualFile: actualFile // Use the actual File object for processing
        });
        alert('Template creation initiated!');
        
        // Optionally reset the form after submission
        // setActualFile(null);
        // dispatch(resetForm());
    };

    const isFormValid = formData.reportFile !== null && actualFile !== null;

    return (
        <div className="bg-theme-secondary border border-theme-primary rounded-lg p-4 dashboard-content">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">New Template</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label
                        htmlFor="report-file"
                        className="block text-sm font-medium text-theme-primary mb-2"
                    >
                        Load an existing report to automate
                        <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input
                        id="report-file"
                        name="reportFile"
                        type="file"
                        required
                        onChange={handleFileChange}
                        className="w-full px-3 py-2 border border-theme-primary rounded-md bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-theme-primary file:text-theme-secondary hover:file:bg-opacity-80"
                        accept=".pdf,application/pdf"
                    />
                    {formData.reportFile && (
                        <p className="text-sm text-theme-primary/70 mt-1">
                            Selected: {formData.reportFile.name} ({Math.round(formData.reportFile.size / 1024)} KB)
                        </p>
                    )}
                </div>

                <div>
                    <label
                        htmlFor="template-name"
                        className="block text-sm font-medium text-theme-primary mb-2"
                    >
                        Give the template a name
                    </label>
                    <input
                        id="template-name"
                        name="templateName"
                        type="text"
                        value={formData.templateName}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-theme-primary rounded-md bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent"
                        placeholder="Enter template name..."
                    />
                </div>

                <div>
                    <label
                        htmlFor="description"
                        className="block text-sm font-medium text-theme-primary mb-2"
                    >
                        Describe your report
                    </label>
                    <textarea
                        id="description"
                        name="description"
                        rows={4}
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-theme-primary rounded-md bg-theme-secondary text-theme-primary focus:outline-none focus:ring-2 focus:ring-theme-primary focus:border-transparent resize-vertical"
                        placeholder="Describe what this report does..."
                    />
                </div>
                <div className="pt-4">
                    <Button
                        displayText="Create Template"
                        variant="primary"
                        size="medium"
                        className="w-full"
                        type="submit"
                        disabled={!isFormValid}
                    />
                </div>
            </form>
        </div>
    );
}