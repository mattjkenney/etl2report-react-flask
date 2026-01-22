import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { initializeInput, updateField, selectInputState } from '../store/dash/manualInput';
import TooltipButton from './TooltipButton';
import ViewBoundingBoxButton from './ViewBoundingBoxButton';
import VariableContainer from './VariableContainer';

export default function ManualInput({ id, index, templateName, onDragStart, onDragOver, onDrop, isDragging }) {
    const dispatch = useDispatch();
    const textractBlocks = useSelector((state) => state.pdfViewer.textractBlocks);
    const inputState = useSelector((state) => selectInputState(state, templateName, id));
    
    // Initialize state in Redux cache on mount
    useEffect(() => {
        dispatch(initializeInput({ templateId: templateName, inputId: id }));
    }, [dispatch, templateName, id]);

    // Extract values from Redux state
    const {
        name,
        type,
        prompt,
        helpText,
        previewValue,
        precision,
        min,
        max,
        allowInequalities,
        inequalityOperator,
        roundingType,
        sigFigs,
        rounding,
        formattedValue,
    } = inputState;

    const block = textractBlocks?.find(b => b.Id === id);
    
    // Helper function to update fields in Redux
    const updateInputField = (field, value) => {
        dispatch(updateField({ templateId: templateName, inputId: id, field, value }));
    };

    // Initialize name if empty
    useEffect(() => {
        if (!name) {
            updateInputField('name', `Manual input ${index}`);
        }
    }, [name, index]);

    // Call backend API to format number when previewValue or formatting options change
    useEffect(() => {
        if (type !== 'number' || !previewValue) {
            updateInputField('formattedValue', previewValue);
            return;
        }

        const formatNumber = async () => {
            if (roundingType === 'none') {
                updateInputField('formattedValue', previewValue);
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
                    updateInputField('formattedValue', data.formatted);
                } else {
                    // Fallback to original value if API fails
                    updateInputField('formattedValue', previewValue);
                }
            } catch (error) {
                console.error('Error formatting number:', error);
                // Fallback to original value if API fails
                updateInputField('formattedValue', previewValue);
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
            name={name || `Manual input ${index}`}
            onNameChange={(newName) => updateInputField('name', newName)}
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
                                    onChange={(e) => updateInputField('prompt', e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Help Text</label>
                                <input
                                    type="text"
                                    placeholder="Enter help text"
                                    value={helpText}
                                    onChange={(e) => updateInputField('helpText', e.target.value)}
                                    className="form-input"
                                />
                            </div>
                            <div className="form-field">
                                <label className="form-label">Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => updateInputField('type', e.target.value)}
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
                                            onChange={(e) => updateInputField('precision', e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="form-label">Min</label>
                                        <input
                                            type="number"
                                            placeholder="Enter minimum value"
                                            value={min}
                                            onChange={(e) => updateInputField('min', e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="form-label">Max</label>
                                        <input
                                            type="number"
                                            placeholder="Enter maximum value"
                                            value={max}
                                            onChange={(e) => updateInputField('max', e.target.value)}
                                            className="form-input"
                                        />
                                    </div>
                                    <div className="form-field">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={allowInequalities}
                                                onChange={(e) => updateInputField('allowInequalities', e.target.checked)}
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
                                                    onChange={(e) => updateInputField('roundingType', e.target.value)}
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
                                                    onChange={(e) => updateInputField('roundingType', e.target.value)}
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
                                                    onChange={(e) => updateInputField('roundingType', e.target.value)}
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
                                                onChange={(e) => updateInputField('sigFigs', e.target.value)}
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
                                                onChange={(e) => updateInputField('rounding', e.target.value)}
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
                                                    onChange={(e) => updateInputField('inequalityOperator', e.target.value)}
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
                                                    onChange={(e) => updateInputField('inequalityOperator', e.target.value)}
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
                                                    onChange={(e) => updateInputField('inequalityOperator', e.target.value)}
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
                                        onChange={(e) => updateInputField('previewValue', e.target.value)}
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
