function write(level, message, meta = {}) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') return console.error(line);
  if (level === 'warn') return console.warn(line);
  return console.log(line);
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

