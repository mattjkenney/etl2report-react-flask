import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export default function TooltipButton({ content }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
                setShowTooltip(false);
            }
        };

        if (showTooltip) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showTooltip]);

    return (
        <div className="relative inline-block" ref={tooltipRef}>
            <motion.button
                type="button"
                onClick={() => setShowTooltip(!showTooltip)}
                whileHover={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 0.3 }}
                className="inline-flex items-center justify-center text-gray-500 hover:text-blue-500 transition-colors cursor-pointer"
                style={{ width: '14px', height: '14px' }}
            >
                <svg style={{ width: '14px', height: '14px' }} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
            </motion.button>
            {showTooltip && (
                <div className="absolute left-full ml-2 top-1/2 z-10 px-3 py-2 text-xs rounded shadow-lg" style={{ transform: 'translateY(-50%)', backgroundColor: '#1f2937', color: '#ffffff', minWidth: '300px', whiteSpace: 'normal' }}>
                    {content}
                    <div className="absolute right-full top-1/2 border-4" style={{ transform: 'translateY(-50%)', borderColor: 'transparent #1f2937 transparent transparent' }}></div>
                </div>
            )}
        </div>
    );
}
