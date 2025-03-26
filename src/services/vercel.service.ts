import { EnvironmentConfig } from '../types/config';
import axios from 'axios';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function makeVercelApiCall(url: string, method: 'get' | 'post' | 'patch', data?: any, retryCount = 0): Promise<any> {
  if (!process.env.VERCEL_TOKEN) {
    throw new Error('VERCEL_TOKEN environment variable is not set. Please set it before deploying.');
  }

  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    if (error && typeof error === 'object' && 'response' in error &&
        retryCount < MAX_RETRIES &&
        ((error as any).response?.status >= 500 || (error as any).code === 'ECONNRESET')) {
      console.log(`API call failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      return makeVercelApiCall(url, method, data, retryCount + 1);
    }

    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    }
    
    if (error && typeof error === 'object' && 'response' in error) {
      const response = (error as any).response;
      const apiError = response?.data?.error?.message || response?.statusText;
      errorMessage = apiError ? `Vercel API error (${response.status || 'network error'}): ${apiError}` : errorMessage;
    }
    
    throw new Error(errorMessage);
  }
}

export async function setVercelEnvironment(config: EnvironmentConfig): Promise<void> {
  if (!config.environmentVariables || Object.keys(config.environmentVariables).length === 0) {
    console.log('No environment variables to set, skipping');
    return;
  }

  console.log(`Setting ${Object.keys(config.environmentVariables).length} environment variables for ${config.vercelProject}`);
  
  try {
    await makeVercelApiCall(
      `https://api.vercel.com/v1/projects/${config.vercelProject}/env`,
      'patch',
      {
        env: Object.entries(config.environmentVariables || {}).map(([key, value]) => ({
          key,
          value,
          type: 'encrypted'
        }))
      }
    );
    console.log('Environment variables set successfully');
  } catch (error) {
    let errorMessage = 'Failed to set environment variables';
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

export async function deployToVercel(projectId: string): Promise<string> {
  try {
    console.log(`Triggering deployment for project ${projectId}...`);
    const data = await makeVercelApiCall(
      `https://api.vercel.com/v13/deployments`,
      'post',
      {
        name: projectId,
        project: projectId
      }
    );
    
    if (!data.url) {
      throw new Error('Deployment started but no URL was returned');
    }
    
    console.log(`Deployment triggered, URL: ${data.url}`);
    return data.url;
  } catch (error) {
    let errorMessage = 'Failed to deploy to Vercel';
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

export async function getDeploymentStatus(deploymentId: string): Promise<string> {
  try {
    const data = await makeVercelApiCall(
      `https://api.vercel.com/v13/deployments/${deploymentId}`,
      'get'
    );
    return data.state || 'unknown';
  } catch (error) {
    let errorMessage = 'Failed to get deployment status';
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