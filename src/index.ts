import { EnvironmentConfig, AutoDeployConfig } from './types/config';
import { setVercelEnvironment, deployToVercel } from './services/vercel.service';
import { runPreDeployChecks, validateEnvironment } from './services/validation.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import { setupHealthMonitoring } from './services/healthcheck.service';
import { sendDeploymentEvent, trackDeploymentMetrics, finishMetricsTracking, sendMetricsReport } from './services/analytics.service';

export async function deploy(environment: keyof AutoDeployConfig['environments']) {
  const config = await loadConfig();
  
  if (!config.environments[environment]) {
    throw new Error(`Environment "${environment}" not found in configuration`);
  }
  
  const envConfig = config.environments[environment];
  let metrics = trackDeploymentMetrics(envConfig.analytics);

  try {
    console.log(`🚀 Starting deployment to ${environment} environment...`);
    
    if (envConfig.analytics) {
      await sendDeploymentEvent(envConfig.analytics, 'deploy_start', { environment });
    }
    
    // Load configuration and validate
    runPreDeployChecks();
    validateEnvironment(envConfig);
    
    // Set environment variables
    console.log('Setting Vercel environment variables...');
    await setVercelEnvironment(envConfig);
    
    // Execute deployment
    console.log(`Deploying to Vercel project: ${envConfig.vercelProject}...`);
    const deploymentUrl = await deployToVercel(envConfig.vercelProject);
    
    if (envConfig.analytics) {
      await sendDeploymentEvent(envConfig.analytics, 'deploy_success', { 
        environment, 
        deploymentUrl 
      });
    }
    
    // Setup health monitoring if configured
    if (envConfig.healthCheck) {
      console.log('Setting up health monitoring...');
      setupHealthMonitoring(deploymentUrl, envConfig.healthCheck);
    }
    
    metrics = finishMetricsTracking(metrics, true);
    
    if (envConfig.analytics) {
      await sendMetricsReport(envConfig.analytics, metrics);
    }
    
    return deploymentUrl;
  } catch (error) {
    let errorMessage = 'Unknown deployment error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    console.error(`\n🛑 Deployment error: ${errorMessage}`);
    
    metrics = finishMetricsTracking(metrics, false, errorMessage);
    
    if (envConfig.analytics) {
      await sendDeploymentEvent(envConfig.analytics, 'deploy_failure', {
        environment,
        error: errorMessage
      });
      
      await sendMetricsReport(envConfig.analytics, metrics);
    }
    
    throw new Error(`Deployment aborted: ${errorMessage}`);
  } finally {
    if (metrics && envConfig.analytics?.collectMetrics) {
      console.log(`ℹ️ Deployment metrics: ${JSON.stringify(metrics)}`);
    }
  }
}

async function loadConfig(): Promise<AutoDeployConfig> {
  try {
    const configPath = path.join(process.cwd(), 'autodeploy.config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(configData) as AutoDeployConfig;
  } catch (error) {
    let errorMessage = 'Failed to load configuration';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage += `: ${error}`;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage += `: ${String(error.message)}`;
    }
    throw new Error(errorMessage);
  }
}