const SuiteCloudJestConfiguration = require('@oracle/suitecloud-unit-testing/jest-configuration/SuiteCloudJestConfiguration');

module.exports = SuiteCloudJestConfiguration.build({
  projectFolder: '.',
  projectType: SuiteCloudJestConfiguration.ProjectType.ACP,
});
