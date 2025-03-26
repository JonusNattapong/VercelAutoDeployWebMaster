import { DeploymentAnalytics } from '../types/config';
import axios from 'axios';

interface DeploymentMetrics {
  startTime: number;
  memoryUsage: number;
  duration?: number;
  endMemoryUsage?: number;
  deploymentSuccess?: boolean;
  errorDetails?: string;
}

export async function sendDeploymentEvent(analyticsConfig: DeploymentAnalytics, eventType: string, additionalData?: Record<string, any>) {
  if (!analyticsConfig?.trackingId) {
    return;
  }

  try {
    await axios.post(`${analyticsConfig.trackingId}/events`, {
      event: eventType,
      timestamp: new Date().toISOString(),
      metadata: analyticsConfig.collectMetrics ? {
        nodeVersion: process.version,
        platform: process.platform,
        ...additionalData
      } : undefined
    });
    console.log(`Analytics event sent: ${eventType}`);
  } catch (error) {
    let errorMessage = 'Analytics event failed';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage += `: ${String(error.message)}`;
    }
    console.error(errorMessage);
  }
}

export function trackDeploymentMetrics(analyticsConfig?: DeploymentAnalytics): DeploymentMetrics | null {
  if (!analyticsConfig?.collectMetrics) {
    return null;
  }
  
  return {
    startTime: Date.now(),
    memoryUsage: process.memoryUsage().rss
  };
}

export function finishMetricsTracking(metrics: DeploymentMetrics | null, success: boolean, errorMessage?: string): DeploymentMetrics | null {
  if (!metrics) {
    return null;
  }
  
  return {
    ...metrics,
    duration: Date.now() - metrics.startTime,
    endMemoryUsage: process.memoryUsage().rss,
    deploymentSuccess: success,
    errorDetails: errorMessage
  };
}

export async function sendMetricsReport(analyticsConfig: DeploymentAnalytics, metrics: DeploymentMetrics | null) {
  if (!analyticsConfig?.collectMetrics || !metrics) {
    return;
  }
  
  try {
    await sendDeploymentEvent(analyticsConfig, 'deployment_metrics', {
      duration: metrics.duration,
      memoryUsage: metrics.memoryUsage,
      endMemoryUsage: metrics.endMemoryUsage,
      memoryDelta: metrics.endMemoryUsage ? metrics.endMemoryUsage - metrics.memoryUsage : undefined,
      success: metrics.deploymentSuccess
    });
  } catch (error) {
    let errorMessage = 'Failed to send metrics report';
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage += `: ${String(error.message)}`;
    }
    console.error(errorMessage);
  }
}