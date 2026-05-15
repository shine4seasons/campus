const fs = require('fs');

try {
  let content = fs.readFileSync('test_results_utf8.json', 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const data = JSON.parse(content);
  const results = [];

  function walk(suite) {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        spec.tests.forEach(test => {
          const browser = test.projectName;
          const status = test.results[0]?.status || 'unknown';
          const duration = test.results[0]?.duration || 0;
          const name = spec.title;
          const file = spec.file;
          
          results.push({
            File: file,
            Browser: browser,
            TestCase: name,
            Status: status === 'passed' ? '✅ Pass' : (status === 'skipped' ? '⚪ Skip' : '❌ Fail'),
            Duration: (duration / 1000).toFixed(2) + 's'
          });
        });
      });
    }
    if (suite.suites) {
      suite.suites.forEach(walk);
    }
  }

  data.suites.forEach(walk);

  // Group by File
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.File]) grouped[r.File] = [];
    grouped[r.File].push(r);
  });

  // Convert to Markdown Table
  let md = '# System Test Results\n\n';
  md += '| File | Browser | Test Case | Status | Duration |\n';
  md += '| --- | --- | --- | --- | --- |\n';
  
  Object.keys(grouped).sort().forEach(file => {
    grouped[file].forEach(r => {
      md += `| ${r.File} | ${r.Browser} | ${r.TestCase} | ${r.Status} | ${r.Duration} |\n`;
    });
  });

  console.log(md);
} catch (err) {
  console.error('Error parsing JSON:', err.message);
  console.error(err.stack);
}
