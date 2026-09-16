/**
 * Sample test — confirms the test runner and NetSuite module mocks are working.
 * Replace this with real tests as you go.
 */

describe('CI smoke test', () => {
  it('Jest and NetSuite stubs are configured correctly', () => {
    // If this file runs without error, the AMD→CommonJS transform
    // and N/* module stubs are all wired up correctly.
    expect(true).toBe(true);
  });

  it('can require a stubbed NetSuite module', () => {
    const record = require('N/record');
    expect(record).toBeDefined();
  });

  it('can require N/search', () => {
    const search = require('N/search');
    expect(search).toBeDefined();
  });
});
