import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { removeBoundingBoxId, setHoveredBlockId, setSelectedBlockType } from '../store/dash/view';
import { setCurrentPage } from '../store/dash/pdfViewer';
import Button from './Button';
import { formatNumber } from '../utils/numberFormatting';

export default function ManualInput({ id, index }) {
    const dispatch = useDispatch();
    const textractBlocks = useSelector((state) => state.pdfViewer.textractBlocks);
    const [name, setName] = useState(`Manual input ${index}`);
    const [isNameFocused, setIsNameFocused] = useState(false);
    const [type, setType] = useState('');
    const [prompt, setPrompt] = useState('');
    const [helpText, setHelpText] = useState('');
    const [previewValue, setPreviewValue] = useState('');
    const [sigFigs, setSigFigs] = useState('');
    const [rounding, setRounding] = useState('');
    const [showPrecisionTooltip, setShowPrecisionTooltip] = useState(false);
    const [showSigFigsTooltip, setShowSigFigsTooltip] = useState(false);
    const [showRoundingTooltip, setShowRoundingTooltip] = useState(false);
    const [showPreviewHelpTooltip, setShowPreviewHelpTooltip] = useState(false);
    const tooltipRef = useRef(null);
    const sigFigsTooltipRef = useRef(null);
    const roundingTooltipRef = useRef(null);
    const previewHelpTooltipRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                setShowPrecisionTooltip(false);
            }
            if (sigFigsTooltipRef.current && !sigFigsTooltipRef.current.contains(event.target)) {
                setShowSigFigsTooltip(false);
            }
            if (roundingTooltipRef.current && !roundingTooltipRef.current.contains(event.target)) {
                setShowRoundingTooltip(false);
            }
            if (previewHelpTooltipRef.current && !previewHelpTooltipRef.current.contains(event.target)) {
                setShowPreviewHelpTooltip(false);
            }
        };

        if (showPrecisionTooltip || showSigFigsTooltip || showRoundingTooltip || showPreviewHelpTooltip) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showPrecisionTooltip, showSigFigsTooltip, showRoundingTooltip, showPreviewHelpTooltip]);

    const block = textractBlocks?.find(b => b.Id === id);

    const getFormattedPreviewValue = () => {
        if (type !== 'number' || !previewValue) {
            return previewValue;
        }

        return formatNumber(previewValue, { sigFigs, rounding });
    };

    const handleRemove = () => {
        dispatch(removeBoundingBoxId(id));
    };

    const handleHighlight = () => {
        if (block?.Page) {
            dispatch(setCurrentPage(block.Page));
        }
        if (block?.BlockType) {
            dispatch(setSelectedBlockType(block.BlockType));
        }
        dispatch(setHoveredBlockId(id));
        
        // Clear the hover after 3 seconds
        setTimeout(() => {
            dispatch(setHoveredBlockId(null));
        }, 3000);
    };

    return (
        <div className="bg-theme-secondary p-3 rounded border border-theme-primary hover:border-theme-secondary flex items-start gap-3 transition-colors">
            <div className="flex-grow space-y-3">
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setIsNameFocused(true)}
                    onBlur={() => setIsNameFocused(false)}
                    className={`w-full text-base font-semibold bg-transparent text-theme-primary px-0 focus:outline-none ${isNameFocused ? 'italic' : ''}`}
                    style={{ border: 'none', boxShadow: 'none' }}
                />
                <Button
                    displayText="View bounding box"
                    onClick={handleHighlight}
                    variant="ghost"
                    size="small"
                />
                <div className="space-y-2">
                <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">Prompt</label>
                    <input
                        type="text"
                        placeholder="Enter prompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">Help Text</label>
                    <input
                        type="text"
                        placeholder="Enter help text"
                        value={helpText}
                        onChange={(e) => setHelpText(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">Type</label>
                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-xs font-medium text-theme-primary">Precision</label>
                                <div className="relative inline-block" ref={tooltipRef}>
                                    <motion.button
                                        type="button"
                                        onClick={() => setShowPrecisionTooltip(!showPrecisionTooltip)}
                                        whileHover={{ scale: [1, 1.3, 1] }}
                                        transition={{ duration: 0.3 }}
                                        className="inline-flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors cursor-pointer"
                                        style={{ width: '14px', height: '14px' }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </motion.button>
                                    {showPrecisionTooltip && (
                                        <div className="absolute left-full ml-2 top-1/2 z-10 px-3 py-2 text-xs rounded shadow-lg" style={{ transform: 'translateY(-50%)', backgroundColor: '#1f2937', color: '#ffffff', minWidth: '300px', whiteSpace: 'normal' }}>
                                            Precision is the number of digits after the decimal allowed for entry.
                                            <div className="absolute right-full top-1/2 border-4" style={{ transform: 'translateY(-50%)', borderColor: 'transparent #1f2937 transparent transparent' }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <input
                                type="number"
                                placeholder="Enter precision"
                                className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-theme-primary mb-1">Min</label>
                            <input
                                type="number"
                                placeholder="Enter minimum value"
                                className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-theme-primary mb-1">Max</label>
                            <input
                                type="number"
                                placeholder="Enter maximum value"
                                className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-xs font-medium text-theme-primary">Significant Figures</label>
                                <div className="relative inline-block" ref={sigFigsTooltipRef}>
                                    <motion.button
                                        type="button"
                                        onClick={() => setShowSigFigsTooltip(!showSigFigsTooltip)}
                                        whileHover={{ scale: [1, 1.3, 1] }}
                                        transition={{ duration: 0.3 }}
                                        className="inline-flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors cursor-pointer"
                                        style={{ width: '14px', height: '14px' }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </motion.button>
                                    {showSigFigsTooltip && (
                                        <div className="absolute left-full ml-2 top-1/2 z-10 px-3 py-2 text-xs rounded shadow-lg" style={{ transform: 'translateY(-50%)', backgroundColor: '#1f2937', color: '#ffffff', minWidth: '300px', whiteSpace: 'normal' }}>
                                            The number of digits shown on the report, including both sides of the decimal. Significant Figures cannot be used with Rounding.
                                            <div className="absolute right-full top-1/2 border-4" style={{ transform: 'translateY(-50%)', borderColor: 'transparent #1f2937 transparent transparent' }}></div>
                                        </div>
                                    )}
                                </div>
                                {rounding && parseFloat(rounding) !== 0 && (
                                    <motion.span 
                                        className="text-xs font-bold ml-1"
                                        style={{ color: '#ef4444' }}
                                        initial={{ scale: 1 }}
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 0.6, ease: "easeInOut" }}
                                    >
                                        (ignored)
                                    </motion.span>
                                )}
                            </div>
                            <input
                                type="number"
                                placeholder="Enter significant figures"
                                value={sigFigs}
                                onChange={(e) => setSigFigs(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-1 mb-1">
                                <label className="text-xs font-medium text-theme-primary">Rounding</label>
                                <div className="relative inline-block" ref={roundingTooltipRef}>
                                    <motion.button
                                        type="button"
                                        onClick={() => setShowRoundingTooltip(!showRoundingTooltip)}
                                        whileHover={{ scale: [1, 1.3, 1] }}
                                        transition={{ duration: 0.3 }}
                                        className="inline-flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors cursor-pointer"
                                        style={{ width: '14px', height: '14px' }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </motion.button>
                                    {showRoundingTooltip && (
                                        <div className="absolute left-full ml-2 top-1/2 z-10 px-3 py-2 text-xs rounded shadow-lg" style={{ transform: 'translateY(-50%)', backgroundColor: '#1f2937', color: '#ffffff', minWidth: '300px', whiteSpace: 'normal' }}>
                                            The number of digits to right of the decimal to round the input. Rounding cannot be used with Significant Figures.
                                            <div className="absolute right-full top-1/2 border-4" style={{ transform: 'translateY(-50%)', borderColor: 'transparent #1f2937 transparent transparent' }}></div>
                                        </div>
                                    )}
                                </div>
                                {sigFigs && parseFloat(sigFigs) !== 0 && (
                                    <motion.span 
                                        className="text-xs font-bold ml-1"
                                        style={{ color: '#ef4444' }}
                                        initial={{ scale: 1 }}
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 0.6, ease: "easeInOut" }}
                                    >
                                        (ignored)
                                    </motion.span>
                                )}
                            </div>
                            <input
                                type="number"
                                placeholder="Enter rounding"
                                value={rounding}
                                onChange={(e) => setRounding(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-theme-primary rounded bg-theme-primary text-theme-primary placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </>
                )}
                <div className="mt-4 pt-4 border-t border-theme-primary">
                    <h4 className="text-sm font-semibold text-theme-primary mb-3">Preview</h4>
                    <div className="space-y-2">
                        <div className="flex items-center gap-1 mb-1">
                            <label className="text-sm font-medium text-theme-primary">{prompt || 'Prompt'}</label>
                            {helpText && (
                                <div className="relative inline-block" ref={previewHelpTooltipRef}>
                                    <motion.button
                                        type="button"
                                        onClick={() => setShowPreviewHelpTooltip(!showPreviewHelpTooltip)}
                                        whileHover={{ scale: [1, 1.3, 1] }}
                                        transition={{ duration: 0.3 }}
                                        className="inline-flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors cursor-pointer"
                                        style={{ width: '14px', height: '14px' }}
                                    >
                                        <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                    </motion.button>
                                    {showPreviewHelpTooltip && (
                                        <div className="absolute left-full ml-2 top-1/2 z-10 px-3 py-2 text-xs rounded shadow-lg" style={{ transform: 'translateY(-50%)', backgroundColor: '#1f2937', color: '#ffffff', minWidth: '300px', whiteSpace: 'normal' }}>
                                            {helpText}
                                            <div className="absolute right-full top-1/2 border-4" style={{ transform: 'translateY(-50%)', borderColor: 'transparent #1f2937 transparent transparent' }}></div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <input
                            type={type || 'text'}
                            placeholder="Enter value"
                            value={previewValue}
                            onChange={(e) => setPreviewValue(e.target.value)}
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
            </div>
            <button
                onClick={handleRemove}
                className="flex-shrink-0 text-red-600 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                title="Remove"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
