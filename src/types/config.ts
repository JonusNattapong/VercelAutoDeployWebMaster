export interface EnvironmentConfig {
  environmentVariables?: Record<string, string>;
  vercelProject: string;
  apiBaseUrl: string;
  healthCheck: DeploymentHealth;
  analytics?: DeploymentAnalytics;
}

export interface DeploymentHealth {
  expectedStatus: number;
  timeoutMs?: number;
  checkIntervalMs?: number;
}

export interface DeploymentAnalytics {
  trackingId: string;
  collectMetrics?: boolean;
}

export interface AutoDeployConfig {
  environments: {
    [environment: string]: EnvironmentConfig;
  };
}