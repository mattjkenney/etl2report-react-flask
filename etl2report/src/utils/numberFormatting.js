/**
 * Counts the number of significant figures in a number
 * @param {string|number} value - The number to analyze
 * @returns {number} - The count of significant figures
 */
export function countSigFigs(value) {
    if (value === null || value === undefined || value === '') {
        return 0;
    }
    
    // Convert to string and handle scientific notation
    let str = value.toString().toLowerCase();
    
    // Handle scientific notation (e.g., "1.23e+4")
    if (str.includes('e')) {
        const [coefficient] = str.split('e');
        str = coefficient;
    }
    
    // Remove negative sign
    str = str.replace('-', '');
    
    // Remove any whitespace
    str = str.trim();
    
    if (str === '0' || str === '0.0' || str === '0.00') {
        return 1; // Single zero has 1 sig fig
    }
    
    const hasDecimal = str.includes('.');
    
    if (hasDecimal) {
        // Remove the decimal point for counting
        str = str.replace('.', '');
        // Remove leading zeros
        str = str.replace(/^0+/, '');
        // All remaining digits are significant
        return str.length;
    } else {
        // No decimal point
        // Remove leading zeros
        str = str.replace(/^0+/, '');
        // Remove trailing zeros (not significant without decimal)
        str = str.replace(/0+$/, '');
        // Count remaining digits
        return str.length;
    }
}

/**
 * Formats a number according to significant figures rules
 * @param {number} value - The number to format
 * @param {number} sigFigs - The number of significant figures
 * @returns {string} - The formatted number string
 */
export function formatWithSigFigs(value, sigFigs) {
    const numValue = parseFloat(value);
    const precision = Math.floor(sigFigs);
    
    if (isNaN(numValue) || precision <= 0) {
        return value.toString();
    }
    
    if (numValue === 0) return '0';
    
    // Check if the value already has the correct number of sig figs
    const currentSigFigs = countSigFigs(value);
    if (currentSigFigs === precision) {
        return value.toString();
    }
    
    // Get the order of magnitude
    const magnitude = Math.floor(Math.log10(Math.abs(numValue)));
    const scale = Math.pow(10, precision - magnitude - 1);
    const rounded = Math.round(numValue * scale) / scale;
    
    // Determine if we need scientific notation
    const absRounded = Math.abs(rounded);
    const isInteger = absRounded % 1 === 0;
    
    // Use scientific notation if the number is too large OR if it's an integer with trailing zeros
    // (trailing zeros in integers are ambiguous without scientific notation)
    const hasTrailingZeros = isInteger && absRounded >= 10 && absRounded % 10 === 0;
    const needsScientific = absRounded >= Math.pow(10, precision) || (hasTrailingZeros && currentSigFigs > precision);
    
    if (needsScientific) {
        // Format in scientific notation
        const coefficient = rounded / Math.pow(10, magnitude);
        const coefficientStr = coefficient.toFixed(precision - 1);
        const superscriptExp = Math.abs(magnitude).toString().split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
        return `${coefficientStr} × 10${magnitude >= 0 ? '⁺' : '⁻'}${superscriptExp}`;
    } else {
        // Use toPrecision for other cases
        let result = rounded.toPrecision(precision);
        
        // Convert scientific notation back to decimal if reasonable
        if (result.includes('e')) {
            const [coef, exp] = result.split('e');
            const expNum = parseInt(exp);
            if (Math.abs(expNum) < precision) {
                result = rounded.toString();
            } else {
                // Use our custom scientific notation
                const coefficient = rounded / Math.pow(10, magnitude);
                const coefficientStr = coefficient.toFixed(precision - 1);
                const superscriptExp = Math.abs(magnitude).toString().split('').map(d => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]).join('');
                return `${coefficientStr} × 10${magnitude >= 0 ? '⁺' : '⁻'}${superscriptExp}`;
            }
        }
        
        return result;
    }
}

/**
 * Formats a number by rounding to a specified number of decimal places
 * @param {number} value - The number to format
 * @param {number} decimalPlaces - The number of decimal places to round to
 * @returns {string} - The formatted number string
 */
export function formatWithRounding(value, decimalPlaces) {
    const numValue = parseFloat(value);
    const places = Math.floor(decimalPlaces);
    
    if (isNaN(numValue) || places < 0) {
        return value.toString();
    }
    
    const multiplier = Math.pow(10, places);
    return (Math.round(numValue * multiplier) / multiplier).toFixed(places);
}

/**
 * Formats a number based on the provided formatting options
 * @param {string|number} value - The value to format
 * @param {Object} options - Formatting options
 * @param {number} options.sigFigs - Significant figures (optional)
 * @param {number} options.rounding - Decimal places to round (optional)
 * @returns {string} - The formatted value
 */
export function formatNumber(value, options = {}) {
    if (!value || value === '') {
        return '';
    }
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return value.toString();
    }
    
    const { sigFigs, rounding } = options;
    
    // Check if sigFigs should be applied (not ignored)
    const sigFigsValue = parseFloat(sigFigs);
    const roundingValue = parseFloat(rounding);
    const isSigFigsActive = sigFigs && sigFigsValue !== 0 && (!rounding || roundingValue === 0);
    const isRoundingActive = rounding && roundingValue !== 0 && (!sigFigs || sigFigsValue === 0);
    
    if (isSigFigsActive) {
        return formatWithSigFigs(numValue, sigFigsValue);
    } else if (isRoundingActive) {
        return formatWithRounding(numValue, roundingValue);
    }
    
    return value.toString();
}
