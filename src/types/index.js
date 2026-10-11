/**
 * Shared type definitions (JSDoc) for the Agentic Release Life Cycle system.
 */

/**
 * @typedef {'alpha' | 'beta' | 'gamma' | 'prod'} EnvironmentName
 */

/**
 * @typedef {'rolling' | 'canary' | 'blue-green' | 'recreate' | 'a-b'} DeploymentStrategyId
 */

/**
 * @typedef {'GO' | 'NO_GO'} BinaryDecision
 */

/**
 * @typedef {Object} ReleaseContext
 * @property {string} releaseId
 * @property {string} version
 * @property {string} commitSha
 * @property {EnvironmentName} targetEnvironment
 * @property {EnvironmentName} [currentEnvironment]
 * @property {string} [serviceName]
 * @property {Object} [metadata]
 */

/**
 * @typedef {Object} ToolResult
 * @property {string} toolName
 * @property {boolean} success
 * @property {Object} data
 * @property {string[]} [warnings]
 * @property {string[]} [errors]
 */

/**
 * @typedef {Object} AgentDecision
 * @property {BinaryDecision} decision - GO or NO_GO
 * @property {number} confidence - 0 to 1
 * @property {string} rationale
 * @property {DeploymentStrategyId} [deploymentStrategy]
 * @property {string[]} [blockingIssues]
 * @property {string[]} [recommendations]
 * @property {Object} [toolEvidence]
 * @property {string} timestamp
 */

/**
 * @typedef {Object} DeploymentResult
 * @property {boolean} success
 * @property {string} deploymentId
 * @property {DeploymentStrategyId} strategy
 * @property {EnvironmentName} environment
 * @property {string} message
 * @property {Object} [details]
 */
