const { Parser } = require('json2csv');
const logger = require('./logger');

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
    logger.error('csv.conversion_failed', { err: err.message, stack: err.stack });
    throw err;
  }
}

module.exports = { convertToCSV };
