// Ambient globals available inside NetSuite's SuiteScript runtime that the
// @hitc/netsuite-types package does not declare. Used only by `npm run typecheck`.
declare function define(dependencies: string[], factory: (...modules: any[]) => any): void;
declare function define(factory: (...modules: any[]) => any): void;
declare function require(modules: string[], callback: (...modules: any[]) => any): void;
declare function require(module: string): any;
declare function nlapiGetContext(): any;
