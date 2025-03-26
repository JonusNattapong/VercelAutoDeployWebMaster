import { DeploymentHealth } from '../types/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface HealthCheckResult {
  timestamp: string;
  url: string;
  status: number;
  healthy: boolean;
  responseTime?: string;
  error?: string;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export async function checkDeploymentHealth(
  url: string, 
  config: DeploymentHealth,
  retryCount = 0
): Promise<HealthCheckResult> {
  const timestamp = new Date().toISOString();
  
  try {
    const startTime = Date.now();
    const response = await axios({
      method: 'GET',
      url,
      timeout: config.timeoutMs || 5000,
      validateStatus: status => true // Don't throw on any status code
    });
    const responseTime = Date.now() - startTime;

    const result = {
      timestamp,
      url,
      status: response.status,
      healthy: response.status === config.expectedStatus,
      responseTime: `${responseTime}ms`
    };

    return result;
  } catch (error) {
    // Network error or timeout, retry if applicable
    if (error && typeof error === 'object' && 'message' in error && retryCount < MAX_RETRIES) {
      console.log(`Health check attempt failed (${retryCount + 1}/${MAX_RETRIES}), retrying... (Error: ${String(error.message)})`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return checkDeploymentHealth(url, config, retryCount + 1);
    }

    return {
      timestamp,
      url,
      status: 503,
      healthy: false,
      error: error instanceof Error ? error.message :
             typeof error === 'string' ? error :
             error && typeof error === 'object' && 'message' in error ? String(error.message) :
             'Unknown error'
    };
  }
}

export function setupHealthMonitoring(url: string, config: DeploymentHealth) {
  let healthyStreak = 0;
  let unhealthyStreak = 0;
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, `health-${new Date().toISOString().replace(/:/g, '-')}.log`);
  
  // Ensure log directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  console.log(`🔍 Health monitoring started for ${url}`);
  console.log(`Health check interval: ${config.checkIntervalMs || 30000}ms`);
  console.log(`Health logs will be stored in: ${logFile}`);
  
  // Initial health check
  checkDeploymentHealth(url, config).then(logHealthCheck);
  
  const interval = setInterval(async () => {
    const health = await checkDeploymentHealth(url, config);
    logHealthCheck(health);
  }, config.checkIntervalMs || 30000);

  function logHealthCheck(health: HealthCheckResult) {
    // Update streaks
    if (health.healthy) {
      healthyStreak++;
      unhealthyStreak = 0;
    } else {
      unhealthyStreak++;
      healthyStreak = 0;
    }
    
    // Determine log level based on health
    const logLevel = health.healthy ? 'INFO' : 'ERROR';
    const logMessage = `[${health.timestamp}] [${logLevel}] ${health.url} - Status: ${health.status} ${health.healthy ? '✅' : '❌'} ${health.responseTime || ''} ${health.error ? `- Error: ${health.error}` : ''}`;
    
    // Log to console
    if (health.healthy) {
      if (healthyStreak === 1) {
        console.log(`✅ Health check passed for ${health.url} (Status: ${health.status})`);
      } else if (healthyStreak % 5 === 0) {
        console.log(`✅ Health check stable: ${healthyStreak} consecutive successful checks`);
      }
    } else {
      console.error(`❌ Health check failed for ${health.url} (Status: ${health.status})${health.error ? `: ${health.error}` : ''}`);
      
      if (unhealthyStreak >= 3) {
        console.error(`⚠️ ALERT: ${unhealthyStreak} consecutive health check failures!`);
      }
    }
    
    // Log to file
    fs.appendFileSync(logFile, logMessage + '\n');
  }

  return () => {
    clearInterval(interval);
    console.log(`🛑 Health monitoring stopped for ${url}`);
  };
}