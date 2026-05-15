const { Parser } = require('json2csv');

/**
 * Convert JSON data to CSV string
 * @param {Array} data - Array of objects to convert
 * @param {Array} fields - Specific fields to include (optional)
 * @returns {String} - CSV content
 */
function convertToCSV(data, fields) {
  try {
    const opts = fields ? { fields } : {};
    const parser = new Parser(opts);
    const csv = parser.parse(data);
    return csv;
  } catch (err) {
    console.error('CSV conversion error:', err);
    throw err;
  }
}

module.exports = { convertToCSV };
