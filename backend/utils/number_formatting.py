"""
Number formatting utilities for handling significant figures and rounding.
Python implementation matching the JavaScript numberFormatting.js functionality.
"""

from sigfig import round as sigfig_round
from decimal import Decimal

def format_with_rounding(value: float, decimal_places: int, use_scientific_notation: bool = False) -> str:
    """
    Format a number with the specified number of decimal places.
    
    Args:
        value (float): The number to format. Must be convertible to float.
        decimal_places (int): The number of decimal places. Must be a non-negative integer.
        
    Returns:
        str: The number formatted to the specified decimal places.
        
    Raises:
        ValueError: If value is not numeric, decimal_places is not an integer,
                    or decimal_places is negative.
    """
    
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError("value must be a number")
    
    try:
        decimal_places = int(decimal_places)
    except (TypeError, ValueError):
        raise ValueError("decimal_places must be an integer")
    
    notation = 'scientific' if use_scientific_notation else 'standard'

    return sigfig_round(value, decimals=decimal_places, output_type=str, warn=False, notation= notation)

def format_with_sig_figs(value: float, sig_figs: int, force_scientific: bool = False, scientific_notation_indicator='E') -> str:
    """
    Format a number with the specified significant figures.
    Uses standard notation when possible, but switches to scientific notation
    if the rounded value would lose significant figures in standard notation.
    
    Args:
        value (float): The number to format. Must be convertible to float.
        sig_figs (int): The number of significant figures. Must be a positive integer.
        
    Returns:
        str: The number formatted to the specified significant figures.
             Returns scientific notation (e.g., '1.00E3') when needed to preserve sig figs,
             otherwise returns standard notation (e.g., '1.0').
             
    Raises:
        ValueError: If value is not numeric, sig_figs is not an integer, 
                   or sig_figs is not positive.
    """
    
    try:
        value = float(value)
    except (TypeError, ValueError):
        raise ValueError("value must be a number")
    
    try:
        sig_figs = int(sig_figs)
    except (TypeError, ValueError):
        raise ValueError("sig_figs must be an integer")
    
    if sig_figs <= 0:
        raise ValueError("sig_figs must be a positive integer")

    if force_scientific:
        return sigfig_round(value, sig_figs, output_type=str, warn=False, notation='scientific')
    
    standard_rounded_value = sigfig_round(value, sig_figs, output_type=str, warn=False, notation='standard')
    counted_sig_figs = count_sig_figs(standard_rounded_value)
    if counted_sig_figs < sig_figs:
        # If the rounded value has fewer significant figures, use scientific notation
        return sigfig_round(value, sig_figs, output_type=str, warn=False, notation='scientific')
    
    return standard_rounded_value

def count_sig_figs(value: str) -> int:
    """
    Count the number of significant figures in a numeric string.
    Handles integers, decimals, and scientific notation.
    
    Args:
        value (str): A string representation of a number.
        
    Returns:
        int: The count of significant figures in the value.
             - Trailing zeros in integers without decimal point are not significant
             - All digits after decimal point are significant
             - Leading zeros are never significant
             - Scientific notation exponent is ignored for counting
    """
    
    def count_integer_sig_figs(value: str) -> int:
        """Count significant figures in an integer by removing trailing zeros."""
        sig_figs = len(value)
        while value.endswith('0'):
            sig_figs -= 1
            value = value[:-1]
        return sig_figs
    
    def count_decimal_sig_figs(value_list) -> int:
        """
        Count significant figures in a decimal number split by decimal point.
        
        Args:
            value_list: A list with [integer_part, decimal_part] from split('.')
            
        Returns:
            int: Total significant figures from both parts.
        """
        integer_part = value_list[0]
        if integer_part.count('0') == len(integer_part):
            # Integer part is all zeros (e.g., '0' or '000'), don't count them
            sig_figs = 0
        else:
            # Count all digits in integer part (all are significant)
            sig_figs = len(integer_part)
        
        # Count significant figures in decimal part
        decimal_part = value_list[1]
        if sig_figs > 0:
            # leading zeros are bound - all digits count
            return sig_figs + len(decimal_part)
        
        if decimal_part.count('0') == len(decimal_part):
            # Decimal part is all zeros (e.g., '.000'), count all of them
            return sig_figs + len(decimal_part)
        
        # Reverse the decimal part to count from right to left,
        # removing trailing zeros (which are still significant in decimal)
        decimal_part_reversed_str = decimal_part[::-1]
        sig_figs += count_integer_sig_figs(decimal_part_reversed_str)
        
        return sig_figs
    
    # Remove leading and trailing spaces
    value_str = str(value).strip()

    # Remove scientific notation exponent (e.g., 'e5' or 'E-4') for counting
    # Only count significant figures in the coefficient
    try:
        eIndex = value_str.lower().index('e')
        value_str = value_str[:eIndex]
    except ValueError:
        pass  # No 'e' in the string, continue with full value

    # Split by decimal point to handle integer and decimal parts separately
    value_split = value_str.split('.')

    if len(value_split) == 1:
        # No decimal point found, treat as integer
        return count_integer_sig_figs(value_split[0])
    
    # Has decimal point, use decimal counting logic
    return count_decimal_sig_figs(value_split)
    
    

if __name__ == "__main__":

    assert count_sig_figs('0.004560') == 4, 'unbound decimal'
    assert count_sig_figs('120.0040') == 7, 'bound decimal'
    assert count_sig_figs('1000') == 1, 'no decimal with trailing zeros'
    assert count_sig_figs('12010') == 4, 'no decimal with bound zeros'
    assert count_sig_figs('0') == 0, 'zero'
    assert count_sig_figs('123E5') == 3, 'scientific notation'
    

    assert format_with_sig_figs(1000, 3) == '1.00E3'
    assert format_with_sig_figs(1000, 2) == '1.0E3'
    assert format_with_sig_figs(1000, 1) == '1000'
    assert format_with_sig_figs(100.0, 2) == '1.0E2'
    assert format_with_sig_figs(10.0, 2) == '1.0E1'
    assert format_with_sig_figs(1.000, 2) == '1.0'

    assert format_with_sig_figs(0.004560, 1) == '0.005'
    assert format_with_sig_figs(105.004560, 3) == '105'
    assert format_with_sig_figs(105.004560, 5) == '105.00'
    assert format_with_sig_figs(10.5004560, 5) == '10.500'

    assert format_with_sig_figs(0.15, 1) == '0.2', 'rounding up to even'
    assert format_with_sig_figs(0.25, 1) == '0.3', 'rounding up to odd'
    
    # force scientific notation
    assert format_with_sig_figs(1000, 1, True) == '1E3'