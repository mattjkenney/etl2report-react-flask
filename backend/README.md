# Flask Backend for ETL2Report

Python Flask backend API server for the ETL2Report React application.

## Features

- **Number Formatting APIs**: Leverage Python's math capabilities for precise number formatting
  - Significant figures calculation and formatting
  - Decimal place rounding
  - Flexible number formatting with options

- **Dataframe Operations**: Pandas-powered data processing
  - Filter, sort, and transform tabular data
  - Aggregation and grouping operations
  - Statistical calculations
  - Data type conversions

## Setup

### Prerequisites

- Python 3.9 or higher
- pip

### Installation

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
```bash
# On Windows
venv\Scripts\activate

# On Linux/Mac
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

### Running the Server

Development mode:
```bash
python app.py
```

Production mode with Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

The server will start on `http://localhost:5000`

## API Endpoints

### Health Check

- **GET** `/api/health` - Health check endpoint

### Number Formatting

- **POST** `/api/format/sig-figs` - Format number with significant figures
  ```json
  {
    "value": 123.456,
    "sigFigs": 3
  }
  ```

- **POST** `/api/format/rounding` - Round number to decimal places
  ```json
  {
    "value": 123.456789,
    "decimalPlaces": 2
  }
  ```

- **POST** `/api/format/number` - Format number with flexible options
  ```json
  {
    "value": 123.456,
    "options": {
      "sigFigs": 3,
      "rounding": 0
    }
  }
  ```

- **POST** `/api/format/count-sig-figs` - Count significant figures
  ```json
  {
    "value": "123.456"
  }
  ```

### Dataframe Operations

- **POST** `/api/dataframe/process` - Process dataframe with operations
  ```json
  {
    "data": [{"col1": 1, "col2": "a"}, {"col1": 2, "col2": "b"}],
    "operations": [
      {"type": "filter", "column": "col1", "condition": "greater_than", "value": 1}
    ]
  }
  ```

- **POST** `/api/dataframe/aggregate` - Aggregate dataframe
  ```json
  {
    "data": [{"category": "A", "sales": 100}, {"category": "A", "sales": 200}],
    "groupBy": ["category"],
    "aggregations": {"sales": "sum"}
  }
  ```

- **POST** `/api/dataframe/transform` - Transform dataframe
  ```json
  {
    "data": [{"value": 10}, {"value": 20}],
    "transformations": [
      {"type": "add_column", "name": "doubled", "value": 0},
      {"type": "calculate", "name": "doubled", "expression": "value * 2"}
    ]
  }
  ```

## Development

### Project Structure

```
backend/
├── app.py                          # Main Flask application
├── requirements.txt                # Python dependencies
├── utils/
│   ├── number_formatting.py        # Number formatting utilities
│   └── dataframe_operations.py     # Dataframe processing utilities
└── README.md                       # This file
```

### CORS Configuration

The API is configured to accept requests from:
- `http://localhost:5173` (Vite dev server)
- `http://localhost:3000` (Alternative React dev server)

Modify the CORS settings in `app.py` to add additional origins as needed.

## Testing

Test the API endpoints using curl, Postman, or your frontend application.

Example curl command:
```bash
curl -X POST http://localhost:5000/api/format/sig-figs \
  -H "Content-Type: application/json" \
  -d '{"value": 123.456, "sigFigs": 3}'
```
