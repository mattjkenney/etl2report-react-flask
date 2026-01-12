export default function EditTemplate({ templateName, onBack }) {
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-theme-primary">
                Edit Template: {templateName}
            </h3>
            <p className="text-theme-primary">
                Template editing interface will be implemented here.
            </p>
        </div>
    );
}
