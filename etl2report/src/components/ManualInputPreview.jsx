import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { updateField, selectItemState } from '../store/dash/variables';
import { updateFormattedValue, selectFormattedValue } from '../store/dash/previewValues';
import { selectBinding } from '../store/dash/boxBindings';
import TooltipButton from './TooltipButton';

export default function ManualInputPreview({ id }) {
    const dispatch = useDispatch();
    const templateId = useSelector(state => state.templates.currentTemplate);
    const itemState = useSelector(state => selectItemState(state, 'manuals', templateId, id));
    
    // Get formatted value from store
    const storedFormattedValue = useSelector(state => selectFormattedValue(state, id));
    
    // Get bound box IDs for this input
    const boundBoxIds = useSelector(state => selectBinding(state, id));
    
    const {
        prompt,
        helpText,
        type,
        allowInequalities,
        inequalityOperator,
        precision,
        min,
        max,
        roundingType,
        sigFigs,
        rounding
    } = itemState;
    
    const [showPreview, setShowPreview] = useState(false);
    const [previewValue, setPreviewValue] = useState('');

    // Format number when previewValue or formatting options change
    useEffect(() => {
        if (type !== 'number' || !previewValue) {
            // For non-number types or empty values, use the raw preview value
            const finalValue = type === 'number' && allowInequalities && inequalityOperator !== '=' 
                ? inequalityOperator + previewValue 
                : previewValue;
            
            // Update Redux store with formatted value and sync to boxes
            dispatch(updateFormattedValue({
                inputId: id,
                value: finalValue,
                boundBoxIds: boundBoxIds
            }));
            return;
        }

        const formatNumber = async () => {
            if (roundingType === 'none' || !roundingType) {
                const finalValue = allowInequalities && inequalityOperator !== '=' 
                    ? inequalityOperator + previewValue 
                    : previewValue;
                
                // Update Redux store
                dispatch(updateFormattedValue({
                    inputId: id,
                    value: finalValue,
                    boundBoxIds: boundBoxIds
                }));
                return;
            }
            
            let apiEndpoint = '';
            let data = { value: previewValue };
            
            if (roundingType === 'sigfigs') {
                apiEndpoint = 'sig-figs';
                data['sigFigs'] = sigFigs || 0;
            } else if (roundingType === 'standard') {
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
                    const result = await response.json();
                    const formatted = result.formatted;
                    const finalValue = allowInequalities && inequalityOperator !== '=' 
                        ? inequalityOperator + formatted 
                        : formatted;
                    
                    // Update Redux store with formatted value and sync to boxes
                    dispatch(updateFormattedValue({
                        inputId: id,
                        value: finalValue,
                        boundBoxIds: boundBoxIds
                    }));
                } else {
                    const finalValue = allowInequalities && inequalityOperator !== '=' 
                        ? inequalityOperator + previewValue 
                        : previewValue;
                    
                    dispatch(updateFormattedValue({
                        inputId: id,
                        value: finalValue,
                        boundBoxIds: boundBoxIds
                    }));
                }
            } catch (error) {
                console.error('Error formatting number:', error);
                const finalValue = allowInequalities && inequalityOperator !== '=' 
                    ? inequalityOperator + previewValue 
                    : previewValue;
                
                dispatch(updateFormattedValue({
                    inputId: id,
                    value: finalValue,
                    boundBoxIds: boundBoxIds
                }));
            }
        };

        formatNumber();
    }, [previewValue, roundingType, sigFigs, rounding, type, allowInequalities, inequalityOperator, dispatch, id, boundBoxIds]);

    const handleValueChange = (value) => {
        setPreviewValue(value);
        if (templateId && id) {
            dispatch(updateField({ 
                sectionId: 'manuals', 
                templateId, 
                itemId: id, 
                field: 'previewValue', 
                value 
            }));
        }
    };

    const handleInequalityChange = (value) => {
        if (templateId && id) {
            dispatch(updateField({ 
                sectionId: 'manuals', 
                templateId, 
                itemId: id, 
                field: 'inequalityOperator', 
                value 
            }));
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-1 mb-1">
                {prompt && <label className="form-label mb-0 text-sm">{prompt}</label>}
                {helpText && <TooltipButton content={helpText} />}
            </div>
            {type === 'number' && allowInequalities && (
                <div className="flex items-center gap-3 mb-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="radio"
                            name={`inequality-${id}`}
                            value="="
                            checked={inequalityOperator === '='}
                            onChange={(e) => handleInequalityChange(e.target.value)}
                            className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-theme-primary">=</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="radio"
                            name={`inequality-${id}`}
                            value=">"
                            checked={inequalityOperator === '>'}
                            onChange={(e) => handleInequalityChange(e.target.value)}
                            className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-theme-primary">&gt;</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="radio"
                            name={`inequality-${id}`}
                            value="<"
                            checked={inequalityOperator === '<'}
                            onChange={(e) => handleInequalityChange(e.target.value)}
                            className="form-radio h-4 w-4 text-blue-500 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-theme-primary">&lt;</span>
                    </label>
                </div>
            )}
            <div className="flex items-center gap-2">
                <input
                    type={type || 'text'}
                    placeholder="Enter value"
                    value={previewValue}
                    onChange={(e) => handleValueChange(e.target.value)}
                    step={type === 'number' && precision ? precision : undefined}
                    min={type === 'number' && min ? min : undefined}
                    max={type === 'number' && max ? max : undefined}
                    className="flex-1 px-3 py-2 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {
                    <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="px-3 py-2 text-sm border border-theme-primary rounded bg-theme-secondary text-theme-primary hover:bg-theme-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                        title={showPreview ? "Hide formatted preview" : "Show formatted preview"}
                    >
                        {showPreview ? '✓' : '🔍'}
                    </button>
                }
            </div>
            {showPreview && previewValue && (
                <div className="mt-2 p-2 bg-theme-tertiary rounded">
                    <p className="text-xs text-theme-secondary mb-1">Report Display:</p>
                    <p className="text-sm font-medium text-theme-primary">{storedFormattedValue}</p>
                </div>
            )}
        </div>
    );
}
