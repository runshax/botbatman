const FormulaParser = require('hot-formula-parser').Parser;

// Initialize the parser
const parser = new FormulaParser();

/**
 * Parse and evaluate a formula
 * @param {string} formula - The formula to parse (e.g., "SUM(1,2,3)" or "=MAX(10,20)")
 * @returns {object} - { success: boolean, result: any, error: string }
 */
const parseFormula = (formula) => {
  try {
    // Remove leading '=' if present
    const cleanFormula = formula.trim().startsWith('=')
      ? formula.trim().substring(1)
      : formula.trim();

    // Parse the formula
    const result = parser.parse(cleanFormula);

    // Check if there's an error
    if (result.error) {
      return {
        success: false,
        result: null,
        error: getErrorMessage(result.error)
      };
    }

    return {
      success: true,
      result: result.result,
      error: null
    };
  } catch (err) {
    return {
      success: false,
      result: null,
      error: err.message || 'Unknown error occurred'
    };
  }
};

/**
 * Add a custom function to the parser
 * @param {string} name - Function name (e.g., "GREETING")
 * @param {function} handler - Function handler
 */
const addCustomFunction = (name, handler) => {
  parser.setFunction(name.toUpperCase(), handler);
};

/**
 * Get user-friendly error message
 * @param {string} error - Error code from parser
 * @returns {string} - User-friendly error message
 */
const getErrorMessage = (error) => {
  const errorMessages = {
    '#DIV/0!': 'Division by zero',
    '#NAME?': 'Unknown function name',
    '#VALUE!': 'Invalid value',
    '#REF!': 'Invalid cell reference',
    '#N/A': 'Value not available',
    '#NUM!': 'Invalid number',
    '#NULL!': 'Null intersection',
    '#ERROR!': 'General error'
  };

  return errorMessages[error] || error;
};

// Example: Add some custom functions
// You can add more custom functions here or from index.js

// DOUBLE function - multiplies a number by 2
addCustomFunction('DOUBLE', (x) => {
  return x * 2;
});

// GREETING function - returns a greeting message
addCustomFunction('GREETING', (name) => {
  return `Hello, ${name}!`;
});

// TRIPLE function - multiplies a number by 3
addCustomFunction('TRIPLE', (x) => {
  return x * 3;
});

module.exports = { parseFormula, addCustomFunction };
