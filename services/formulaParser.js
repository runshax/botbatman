const { Parser, SUPPORTED_FORMULAS } = require('hot-formula-parser');

// Initialize the parser
const parser = new Parser();

// Track custom function names
const customFunctionNames = [];

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
  if (!customFunctionNames.includes(name.toUpperCase())) {
    customFunctionNames.push(name.toUpperCase());
  }
};

/**
 * Get all supported functions (built-in + custom)
 * @returns {string[]} - Array of supported function names
 */
const getSupportedFunctions = () => {
  return [...(SUPPORTED_FORMULAS || []), ...customFunctionNames];
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

// ==================== CUSTOM FUNCTIONS ====================

// Helper: Format date to MM/DD/YYYY
const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

// Helper: Format datetime to MM/DD/YYYY HH:mm:ss
const formatDateTime = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');
  return `${month}/${day}/${year} ${hour}:${minute}:${second}`;
};

// Date Functions
addCustomFunction('TODAY', () => formatDate(new Date()));
addCustomFunction('DATETIME_NOW', () => formatDateTime(new Date()));

addCustomFunction('DAY', (params) => {
  return params && params[0] ? new Date(params[0]).getDate() : 0;
});

addCustomFunction('MONTH', (params) => {
  return params && params[0] ? String(new Date(params[0]).getMonth() + 1).padStart(2, '0') : '0';
});

addCustomFunction('YEAR', (params) => {
  return params && params[0] ? new Date(params[0]).getFullYear() : 0;
});

addCustomFunction('HOUR', (params) => {
  return params && params[0] ? new Date(params[0]).getHours() : new Date().getHours();
});

addCustomFunction('MINUTE', (params) => {
  return params && params[0] ? new Date(params[0]).getMinutes() : new Date().getMinutes();
});

addCustomFunction('SECOND', (params) => {
  return params && params[0] ? new Date(params[0]).getSeconds() : new Date().getSeconds();
});

addCustomFunction('DAYSINMONTH', (params) => {
  const date = new Date(params[0]);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
});

addCustomFunction('DAYOFWEEK', (params) => {
  return new Date(params[0]).getDay();
});

addCustomFunction('ISDATE', (params) => {
  if (params[0]) {
    const date = new Date(params[0]);
    return date instanceof Date && !isNaN(date.getTime());
  }
  return false;
});

addCustomFunction('ISNUMERIC', (params) => {
  return !isNaN(parseFloat(params[0])) && !isNaN(Number(params[0]));
});

// DATEDIFF function
addCustomFunction('DATEDIFF', (params) => {
  let date1 = new Date(params[1]);
  let date2 = new Date(params[2]);

  const swapped = date1 < date2;
  if (swapped) [date1, date2] = [date2, date1];

  const diffInMs = date1.getTime() - date2.getTime();

  if (!diffInMs) return 0;

  switch (params[0]) {
    case 'YEAR': {
      let years = date1.getFullYear() - date2.getFullYear();
      if (date1.getMonth() < date2.getMonth() ||
        (date1.getMonth() === date2.getMonth() && date1.getDate() < date2.getDate())) {
        years -= 1;
      }
      return swapped ? -years : years;
    }
    case 'MONTH': {
      let months = (date1.getFullYear() - date2.getFullYear()) * 12 +
        (date1.getMonth() - date2.getMonth());
      if (date1.getDate() < date2.getDate()) {
        months -= 1;
      }
      return swapped ? -months : months;
    }
    case 'DAY':
      return swapped ? -Math.floor(diffInMs / (1000 * 60 * 60 * 24)) : Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    case 'HOUR':
      return swapped ? -Math.floor(diffInMs / (1000 * 60 * 60)) : Math.floor(diffInMs / (1000 * 60 * 60));
    case 'MINUTE':
      return swapped ? -Math.floor(diffInMs / (1000 * 60)) : Math.floor(diffInMs / (1000 * 60));
    case 'SECOND':
      return swapped ? -Math.floor(diffInMs / 1000) : Math.floor(diffInMs / 1000);
    default:
      throw new Error('Invalid unit');
  }
});

// DATEADD function
addCustomFunction('DATEADD', (params) => {
  const hasTime = params[2].includes(' ');
  let date = new Date(params[2]);

  switch (params[0]) {
    case 'YEAR':
      date.setFullYear(date.getFullYear() + params[1]);
      break;
    case 'MONTH':
      date.setMonth(date.getMonth() + params[1]);
      break;
    case 'DAY':
      date.setDate(date.getDate() + params[1]);
      break;
    case 'HOUR':
      date.setHours(date.getHours() + params[1]);
      break;
    case 'MINUTE':
      date.setMinutes(date.getMinutes() + params[1]);
      break;
    case 'SECOND':
      date.setSeconds(date.getSeconds() + params[1]);
      break;
    default:
      throw new Error('Invalid unit');
  }

  return hasTime ? formatDateTime(date) : formatDate(date);
});

// DAYS function
addCustomFunction('DAYS', (params) => {
  if (params[0] === '' || params[1] === '') return 0;

  const parseDate = (dateStr) => {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    return new Date(year, month, day);
  };

  const d1 = parseDate(params[0]);
  const d2 = parseDate(params[1]);

  if (!d1 || !d2) return 0;

  return Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
});

// CREATEDATE function
addCustomFunction('CREATEDATE', (params) => {
  if (params.length >= 3) {
    const year = Number(params[0]);
    const month = Number(params[1]) - 1;
    const day = Number(params[2]);
    return formatDate(new Date(year, month, day));
  }
  return formatDate(new Date());
});

// DATE function - parse date string and return timestamp
addCustomFunction('DATE', (params) => {
  if (!params || params.length === 0) {
    throw new Error('DATE function requires at least one argument.');
  }

  const dateStr = params[0];

  // If input is a number, assume it's a timestamp
  if (typeof dateStr === 'number') {
    return dateStr;
  }

  // If input is not a string, throw an error
  if (typeof dateStr !== 'string') {
    throw new Error(`Invalid DATE input: ${dateStr}`);
  }

  // Ensure it's in MM/DD/YYYY format
  const regex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(regex);

  if (!match) {
    throw new Error(`Invalid date format: ${dateStr}. Expected MM/DD/YYYY.`);
  }

  const [, mm, dd, yyyy] = match.map(Number);

  return new Date(yyyy, mm - 1, dd).getTime();
});

// LENGTHOFSERVICE function - calculate service length between two dates
addCustomFunction('LENGTHOFSERVICE', (params) => {
  if (params.length === 3) {
    const [startDate, endDate, unit] = params;

    // Parse dates in MM/DD/YYYY format
    const parseDate = (dateStr) => {
      const parts = dateStr.split('/');
      if (parts.length !== 3) return null;
      const month = parseInt(parts[0], 10) - 1;
      const day = parseInt(parts[1], 10);
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    };

    const d1 = parseDate(startDate);
    const d2 = parseDate(endDate);

    // Check for valid dates
    if (!d1 || !d2) {
      return 0;
    }

    const yearsDifference = d2.getFullYear() - d1.getFullYear();
    const monthsDifference = d2.getMonth() - d1.getMonth();
    const daysDifference = d2.getDate() - d1.getDate();
    const roundUpFractionalMonths = false;
    let monthCorrection = 0;

    // Adjust month correction based on days difference
    if (!roundUpFractionalMonths && daysDifference < 0) {
      monthCorrection = -1;
    }

    // Calculate difference based on the unit
    if (unit === 'm' || unit === 'M') {
      const hasil = (yearsDifference * 12 + monthsDifference + monthCorrection);

      // Handle case where yearsDifference and monthsDifference are both zero
      if (hasil === 0) {
        const d1Y = d1.getFullYear();
        const d2Y = d2.getFullYear();
        const d1M = d1.getMonth() + 1;
        const d2M = d2.getMonth() + 1;
        return d2M + 12 * d2Y - (d1M + 12 * d1Y);
      } else {
        return hasil;
      }

    } else if (unit === 'y' || unit === 'Y') {
      return yearsDifference + (monthsDifference < 0 ? -1 : 0);
    }
  }
  return null;
});

// Text Functions
addCustomFunction('CONCATENATE', (...params) => {
  return params.join('');
});

addCustomFunction('CONCATENATESKIPNULL', (...params) => {
  return params.filter(o => o !== '' && o !== null && o !== undefined).join('');
});

// FINDLIST function
addCustomFunction('FINDLIST', (params) => {
  return params[0].split(',').findIndex(o => o === params[1]) + 1;
});

// Simple utility functions
addCustomFunction('DOUBLE', (x) => x * 2);
addCustomFunction('TRIPLE', (x) => x * 3);
addCustomFunction('GREETING', (name) => `Hello, ${name}!`);

module.exports = { parseFormula, addCustomFunction, getSupportedFunctions };
