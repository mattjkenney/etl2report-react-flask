import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import TooltipButton from './TooltipButton';
import ViewBoundingBoxButton from './ViewBoundingBoxButton';
import VariableContainer from './VariableContainer';

export default function ManualInput({ id, index, onDragStart, onDragOver, onDrop, isDragging }) {
    const textractBlocks = useSelector((state) => state.pdfViewer.textractBlocks);
    const [type, setType] = useState('');
    const [prompt, setPrompt] = useState('');
    const [helpText, setHelpText] = useState('');
    const [previewValue, setPreviewValue] = useState('');
    const [precision, setPrecision] = useState('');
    const [min, setMin] = useState('');
    const [max, setMax] = useState('');
    const [allowInequalities, setAllowInequalities] = useState(false);
    const [inequalityOperator, setInequalityOperator] = useState('=');
    const [roundingType, setRoundingType] = useState('none');
    const [sigFigs, setSigFigs] = useState('');
    const [rounding, setRounding] = useState('');
    const [formattedValue, setFormattedValue] = useState('');

    const block = textractBlocks?.find(b => b.Id === id);

    // Call backend API to format number when previewValue or formatting options change
    useEffect(() => {
        if (type !== 'number' || !previewValue) {
            setFormattedValue(previewValue);
            return;
        }

        const formatNumber = async () => {
            if (roundingType === 'none') {
                setFormattedValue(previewValue);
                return;
            }
            var apiEndpoint = '';
            var data = {value: previewValue};
            if (roundingType === 'sigfigs') {
                apiEndpoint = 'sig-figs';
                data['sigFigs'] = sigFigs || 0;
            }
            else if (roundingType === 'standard') {
                apiEndpoint = 'rounding';
                data['decimalPlaces'] = rounding || 0;
            }
            
            try {
                const backendDomain = import.meta.env.VITE_BACKEND_DOMAIN || 'http://localhost:5000';
                const response = await fetch(`${backendDomain}/api/format/${apiEndpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                if (response.ok) {
                    const data = await response.json();
                    setFormattedValue(data.formatted);
                } else {
                    // Fallback to original value if API fails
                    setFormattedValue(previewValue);
                }
            } catch (error) {
                console.error('Error formatting number:', error);
                // Fallback to original value if API fails
                setFormattedValue(previewValue);
            }
        };

        formatNumber();
    }, [previewValue, roundingType, sigFigs, rounding, type]);

    const getFormattedPreviewValue = () => {
        if (type === 'number' && allowInequalities && inequalityOperator !== '=') {
            return inequalityOperator + formattedValue;
        }
        return formattedValue;
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
                                            value={min}
                                            onChange={(e) => setMin(e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="form-label">Max</label>
                                        <input
                                            type="number"
                                            placeholder="Enter maximum value"
                                            value={max}
                                            onChange={(e) => setMax(e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowInequalities}
                                                onChange={(e) => setAllowInequalities(e.target.checked)}
                                                className="form-checkbox h-4 w-4 rounded border-theme-primary text-blue-500 focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="form-label mb-0">Allow Inequalities</span>
                                        </label>
                                    </div>
                                    <div className="form-field">
                                        <label className="form-label mb-2">Rounding</label>
                                        <div className="flex items-center gap-3 mb-2">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="roundingType"
                                                    value="none"
                                                    checked={roundingType === 'none'}
                                                    onChange={(e) => setRoundingType(e.target.value)}
                                                    className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-theme-primary">None</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="roundingType"
                                                    value="standard"
                                                    checked={roundingType === 'standard'}
                                                    onChange={(e) => setRoundingType(e.target.value)}
                                                    className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-theme-primary">Standard</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="roundingType"
                                                    value="sigfigs"
                                                    checked={roundingType === 'sigfigs'}
                                                    onChange={(e) => setRoundingType(e.target.value)}
                                                    className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-theme-primary">Significant Figures</span>
                                            </label>
                                        </div>
                                    </div>
                                    {roundingType === 'sigfigs' && (
                                        <div className="form-field">
                                            <div className="flex items-center gap-1 mb-1">
                                                <label className="form-label mb-0">Significant Figures</label>
                                                <TooltipButton content="The number of digits shown on the report, including both sides of the decimal." />
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="Enter significant figures"
                                                value={sigFigs}
                                                onChange={(e) => setSigFigs(e.target.value)}
                                                className="form-input"
                                                min={0}
                                            />
                                        </div>
                                    )}
                                    {roundingType === 'standard' && (
                                        <div className="form-field">
                                            <div className="flex items-center gap-1 mb-1">
                                                <label className="form-label mb-0">Decimal Places</label>
                                                <TooltipButton content="The number of digits to right of the decimal to round the input." />
                                            </div>
                                            <input
                                                type="number"
                                                placeholder="Enter rounding"
                                                value={rounding}
                                                onChange={(e) => setRounding(e.target.value)}
                                                className="form-input"
                                                min={0}
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                            <div className="mt-4 pt-4 border-t border-theme-primary">
                                <h4 className="text-sm font-semibold text-theme-primary mb-3">Preview</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1 mb-1">
                                        <label className="form-label mb-0 text-sm">{prompt || 'Prompt'}</label>
                                        {helpText && <TooltipButton content={helpText} />}
                                    </div>
                                    {type === 'number' && allowInequalities && (
                                        <div className="flex items-center gap-3 mb-2">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="inequality"
                                                    value="="
                                                    checked={inequalityOperator === '='}
                                                    onChange={(e) => setInequalityOperator(e.target.value)}
                                                    className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-theme-primary">=</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="inequality"
                                                    value=">"
                                                    checked={inequalityOperator === '>'}
                                                    onChange={(e) => setInequalityOperator(e.target.value)}
                                                    className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-theme-primary">&gt;</span>
                                            </label>
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="inequality"
                                                    value="<"
                                                    checked={inequalityOperator === '<'}
                                                    onChange={(e) => setInequalityOperator(e.target.value)}
                                                    className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="text-sm text-theme-primary">&lt;</span>
                                            </label>
                                        </div>
                                    )}
                                    <input
                                        type={type || 'text'}
                                        placeholder="Enter value"
                                        value={previewValue}
                                        onChange={(e) => setPreviewValue(e.target.value)}
                                        step={type === 'number' && precision ? precision : undefined}
                                        min={type === 'number' && min ? min : undefined}
                                        max={type === 'number' && max ? max : undefined}
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
