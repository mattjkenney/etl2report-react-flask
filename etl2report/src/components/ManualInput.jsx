import { useState } from 'react';
import { useSelector } from 'react-redux';
import TooltipButton from './TooltipButton';
import IgnoredIndicator from './IgnoredIndicator';
import ViewBoundingBoxButton from './ViewBoundingBoxButton';
import VariableContainer from './VariableContainer';
import { formatNumber } from '../utils/numberFormatting';

export default function ManualInput({ id, index, onDragStart, onDragOver, onDrop, isDragging }) {
    const textractBlocks = useSelector((state) => state.pdfViewer.textractBlocks);
    const [type, setType] = useState('');
    const [prompt, setPrompt] = useState('');
    const [helpText, setHelpText] = useState('');
    const [previewValue, setPreviewValue] = useState('');
    const [precision, setPrecision] = useState('');
    const [sigFigs, setSigFigs] = useState('');
    const [rounding, setRounding] = useState('');

    const block = textractBlocks?.find(b => b.Id === id);

    const getFormattedPreviewValue = () => {
        if (type !== 'number' || !previewValue) {
            return previewValue;
        }

        return formatNumber(previewValue, { sigFigs, rounding });
    };

    return (
        <VariableContainer
            id={id}
            index={index}
            name={`Manual input ${index}`}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
            isDragging={isDragging}
            defaultExpanded={false}
        >
            <>
                <ViewBoundingBoxButton block={block} id={id} />
                <div className="space-y-2">
                            <div className="form-field">
                                <label className="form-label">Prompt</label>
                                <input
                                    type="text"
                                    placeholder="Enter prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Help Text</label>
                                <input
                                    type="text"
                                    placeholder="Enter help text"
                                    value={helpText}
                                    onChange={(e) => setHelpText(e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value)}
                                    className="form-input"
                                >
                                    <option value="">Select type</option>
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                    <option value="date">Date</option>
                                    <option value="email">Email</option>
                                    <option value="tel">Phone</option>
                                </select>
                            </div>
                            {type === 'number' && (
                                <>
                                    <div className="form-field">
                                        <div className="flex items-center gap-1 mb-1">
                                            <label className="form-label mb-0">Precision</label>
                                            <TooltipButton content="Precision is the number of digits a number input will increment with the field incrementer." />
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Enter precision"
                                            value={precision}
                                            onChange={(e) => setPrecision(e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="form-label">Min</label>
                                        <input
                                            type="number"
                                            placeholder="Enter minimum value"
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="form-label">Max</label>
                                        <input
                                            type="number"
                                            placeholder="Enter maximum value"
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <div className="flex items-center gap-1 mb-1">
                                            <label className="form-label mb-0">Significant Figures</label>
                                            <TooltipButton content="The number of digits shown on the report, including both sides of the decimal. Significant Figures cannot be used with Rounding." />
                                            <IgnoredIndicator show={rounding && parseFloat(rounding) !== 0} />
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Enter significant figures"
                                            value={sigFigs}
                                            onChange={(e) => setSigFigs(e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <div className="flex items-center gap-1 mb-1">
                                            <label className="form-label mb-0">Rounding</label>
                                            <TooltipButton content="The number of digits to right of the decimal to round the input. Rounding cannot be used with Significant Figures." />
                                            <IgnoredIndicator show={sigFigs && parseFloat(sigFigs) !== 0} />
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Enter rounding"
                                            value={rounding}
                                            onChange={(e) => setRounding(e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                </>
                            )}
                            <div className="mt-4 pt-4 border-t border-theme-primary">
                                <h4 className="text-sm font-semibold text-theme-primary mb-3">Preview</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="form-label mb-0 text-sm">{prompt || 'Prompt'}</label>
                                        {helpText && <TooltipButton content={helpText} />}
                                    </div>
                                    <input
                                        type={type || 'text'}
                                        placeholder="Enter value"
                                        value={previewValue}
                                        onChange={(e) => setPreviewValue(e.target.value)}
                                        step={type === 'number' && precision ? precision : undefined}
                                        className="w-full px-3 py-2 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {previewValue && (
                                        <div className="mt-2 p-2 bg-theme-tertiary rounded">
                                            <p className="text-xs text-theme-secondary mb-1">Report Display:</p>
                                            <p className="text-sm font-medium text-theme-primary">{getFormattedPreviewValue()}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
            </>
        </VariableContainer>
    );
}
