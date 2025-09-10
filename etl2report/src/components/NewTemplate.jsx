import { useState } from 'react';
import Button from './Button';

export default function NewTemplate() {
    const [formData, setFormData] = useState({
        reportFile: null,
        templateName: '',
        description: ''
    });

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData(prev => ({
            ...prev,
            reportFile: file
        }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Basic validation for required field
        if (!formData.reportFile) {
            alert('Please select a report file');
            return;
        }

        // Handle form submission logic here
        console.log('Form submitted:', formData);
        alert('Template creation initiated!');
    };

    const isFormValid = formData.reportFile !== null;

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
                        accept=".pdf"
                    />
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