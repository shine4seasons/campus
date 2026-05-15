const fs = require('fs');

const TEST_METADATA = {
  'should display error message and toast when redirected with banned error': {
    ID: 'TC-AUTH-01',
    Module: 'Authentication',
    Description: 'Verify that a banned user sees an error box and a toast notification.',
    Expected: 'Error box and toast showing "This account has been banned" are visible.'
  },
  'should show loading state when Google button is clicked': {
    ID: 'TC-AUTH-02',
    Module: 'Authentication',
    Description: 'Verify that clicking the Google button shows a loading spinner and "Signing in..." text.',
    Expected: 'Button class becomes "loading", spinner is visible, text changes to "Signing in...".'
  },
  'homepage should load correctly and show main sections': {
    ID: 'TC-HOME-01',
    Module: 'Homepage',
    Description: 'Verify that the homepage loads with Hero, Categories, and Featured sections.',
    Expected: 'Page title and all main sections are visible.'
  },
  'should be able to search and filter products': {
    ID: 'TC-HOME-02',
    Module: 'Homepage',
    Description: 'Verify that searching for an item updates the product grid.',
    Expected: 'Product grid is visible and reflects the search query.'
  },
  'sidebar and topbar navigation': {
    ID: 'TC-NAV-01',
    Module: 'Navigation',
    Description: 'Verify visibility of sidebar and topbar elements.',
    Expected: 'Sidebar and topbar are visible and contain navigation links.'
  },
  'login page accessibility': {
    ID: 'TC-AUTH-03',
    Module: 'Authentication',
    Description: 'Verify that the login page is accessible or redirects if already logged in.',
    Expected: 'Login card is visible or redirected to homepage.'
  },
  'Interested button should toggle heart color and increment count': {
    ID: 'TC-PROD-01',
    Module: 'Product',
    Description: 'Verify that clicking "Interested" changes the heart icon to red and increments the count.',
    Expected: 'Heart icon fills with red (#f87171) and count increases by 1.'
  },
  'Message seller button should redirect to messages': {
    ID: 'TC-PROD-02',
    Module: 'Product',
    Description: 'Verify that clicking "Message seller" redirects to the chat interface.',
    Expected: 'User is redirected to /messages with the correct conversation ID.'
  },
  'has title': {
    ID: 'TC-GEN-01',
    Module: 'General',
    Description: 'Basic Playwright example test for title.',
    Expected: 'Page title matches expected value.'
  },
  'get started link': {
    ID: 'TC-GEN-02',
    Module: 'General',
    Description: 'Basic Playwright example test for link.',
    Expected: 'Redirected to the correct page after clicking link.'
  }
};

try {
  let content = fs.readFileSync('test_results_utf8.json', 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const data = JSON.parse(content);
  const rows = [];

  function walk(suite) {
    if (suite.specs) {
      suite.specs.forEach(spec => {
        spec.tests.forEach(test => {
          const name = spec.title;
          const status = test.results[0]?.status || 'unknown';
          const meta = TEST_METADATA[name] || {
            ID: 'TC-MISC',
            Module: 'Miscellaneous',
            Description: name,
            Expected: 'Test passes'
          };
          
          rows.push({
            ID: meta.ID,
            Module: meta.Module,
            'Test Case': name,
            Description: meta.Description,
            'Expected Result': meta.Expected,
            'Actual Result': status === 'passed' ? 'As expected' : 'Failed or skipped',
            Status: status === 'passed' ? 'PASS' : 'FAIL'
          });
        });
      });
    }
    if (suite.suites) suite.suites.forEach(walk);
  }

  data.suites.forEach(walk);

  // Filter unique IDs (because of multiple browsers)
  // Actually, the user might want to see browser-specific results, but CSV usually lists one row per case.
  // We'll list them all since different browsers might fail differently.
  
  const headers = ['ID', 'Module', 'Test Case', 'Description', 'Expected Result', 'Actual Result', 'Status'];
  let csv = headers.join(',') + '\n';
  
  rows.forEach(row => {
    const csvRow = headers.map(h => {
      let val = row[h] || '';
      val = val.replace(/"/g, '""'); // Escape quotes
      return `"${val}"`;
    });
    csv += csvRow.join(',') + '\n';
  });

  fs.writeFileSync('test_case_results.csv', csv);
  console.log('CSV generated: test_case_results.csv');
} catch (err) {
  console.error(err);
}
