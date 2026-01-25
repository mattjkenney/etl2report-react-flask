"""
Dataframe operations utilities for processing tabular data.
Leverages pandas for powerful data manipulation capabilities.
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Any


def process_dataframe(data: List[Dict], operations: List[Dict] = None) -> Dict:
    """
    Process dataframe data with various operations
    
    Args:
        data: List of dictionaries representing rows
        operations: List of operation dictionaries to apply
    
    Returns:
        Dictionary with processed data
    """
    if operations is None:
        operations = []
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Apply operations
    for op in operations:
        operation_type = op.get('type')
        
        if operation_type == 'filter':
            # Filter rows based on condition
            column = op.get('column')
            condition = op.get('condition')
            value = op.get('value')
            
            if condition == 'equals':
                df = df[df[column] == value]
            elif condition == 'greater_than':
                df = df[df[column] > value]
            elif condition == 'less_than':
                df = df[df[column] < value]
            elif condition == 'contains':
                df = df[df[column].str.contains(str(value), na=False)]
        
        elif operation_type == 'sort':
            # Sort by column(s)
            columns = op.get('columns', [])
            ascending = op.get('ascending', True)
            df = df.sort_values(by=columns, ascending=ascending)
        
        elif operation_type == 'select':
            # Select specific columns
            columns = op.get('columns', [])
            df = df[columns]
        
        elif operation_type == 'rename':
            # Rename columns
            mapping = op.get('mapping', {})
            df = df.rename(columns=mapping)
    
    # Convert back to list of dictionaries
    result = df.to_dict('records')
    
    return {
        'data': result,
        'shape': list(df.shape),
        'columns': list(df.columns),
        'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}
    }


def aggregate_dataframe(data: List[Dict], group_by: List[str] = None, 
                       aggregations: Dict[str, str] = None) -> Dict:
    """
    Perform aggregation operations on dataframe
    
    Args:
        data: List of dictionaries representing rows
        group_by: Columns to group by
        aggregations: Dictionary mapping column names to aggregation functions
                     (e.g., {'sales': 'sum', 'price': 'mean'})
    
    Returns:
        Dictionary with aggregated data
    """
    if group_by is None:
        group_by = []
    if aggregations is None:
        aggregations = {}
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    if group_by and aggregations:
        # Group and aggregate
        result_df = df.groupby(group_by).agg(aggregations).reset_index()
    elif aggregations:
        # Aggregate without grouping
        result_df = df.agg(aggregations).to_frame().T
    else:
        result_df = df
    
    # Convert back to list of dictionaries
    result = result_df.to_dict('records')
    
    return {
        'data': result,
        'shape': list(result_df.shape),
        'columns': list(result_df.columns)
    }


def transform_dataframe(data: List[Dict], transformations: List[Dict] = None) -> Dict:
    """
    Transform dataframe with custom operations
    
    Args:
        data: List of dictionaries representing rows
        transformations: List of transformation dictionaries
    
    Returns:
        Dictionary with transformed data
    """
    if transformations is None:
        transformations = []
    
    # Convert to DataFrame
    df = pd.DataFrame(data)
    
    # Apply transformations
    for transform in transformations:
        transform_type = transform.get('type')
        
        if transform_type == 'add_column':
            # Add a new column
            column_name = transform.get('name')
            value = transform.get('value')
            df[column_name] = value
        
        elif transform_type == 'calculate':
            # Calculate new column based on expression
            column_name = transform.get('name')
            expression = transform.get('expression')
            # Safely evaluate mathematical expressions
            df[column_name] = df.eval(expression)
        
        elif transform_type == 'fill_na':
            # Fill missing values
            column = transform.get('column')
            fill_value = transform.get('value', 0)
            df[column] = df[column].fillna(fill_value)
        
        elif transform_type == 'drop_na':
            # Drop rows with missing values
            subset = transform.get('columns')
            df = df.dropna(subset=subset)
        
        elif transform_type == 'convert_type':
            # Convert column type
            column = transform.get('column')
            dtype = transform.get('dtype')
            df[column] = df[column].astype(dtype)
        
        elif transform_type == 'apply_function':
            # Apply custom function to column
            column = transform.get('column')
            function_name = transform.get('function')
            
            if function_name == 'upper':
                df[column] = df[column].str.upper()
            elif function_name == 'lower':
                df[column] = df[column].str.lower()
            elif function_name == 'strip':
                df[column] = df[column].str.strip()
            elif function_name == 'abs':
                df[column] = df[column].abs()
            elif function_name == 'round':
                decimals = transform.get('decimals', 0)
                df[column] = df[column].round(decimals)
    
    # Convert back to list of dictionaries
    result = df.to_dict('records')
    
    return {
        'data': result,
        'shape': list(df.shape),
        'columns': list(df.columns),
        'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()}
    }


def calculate_statistics(data: List[Dict], columns: List[str] = None) -> Dict:
    """
    Calculate statistical measures for numeric columns
    
    Args:
        data: List of dictionaries representing rows
        columns: Specific columns to analyze (None for all numeric columns)
    
    Returns:
        Dictionary with statistical measures
    """
    df = pd.DataFrame(data)
    
    if columns:
        df = df[columns]
    else:
        # Select only numeric columns
        df = df.select_dtypes(include=[np.number])
    
    stats = {
        'mean': df.mean().to_dict(),
        'median': df.median().to_dict(),
        'std': df.std().to_dict(),
        'min': df.min().to_dict(),
        'max': df.max().to_dict(),
        'count': df.count().to_dict()
    }
    
    return stats
