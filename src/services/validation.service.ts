import { EnvironmentConfig } from '../types/config';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export function validateEnvironment(config: EnvironmentConfig) {
  const errors: string[] = [];

  // Validate required fields
  if (!config.vercelProject) {
    errors.push('vercelProject is required');
  }
  
  if (!config.apiBaseUrl) {
    errors.push('apiBaseUrl is required');
  } else if (!isValidUrl(config.apiBaseUrl)) {
    errors.push(`apiBaseUrl '${config.apiBaseUrl}' is not a valid URL`);
  }
  
  // Validate health check config
  if (!config.healthCheck) {
    errors.push('healthCheck configuration is required');
  } else {
    if (config.healthCheck.expectedStatus === undefined) {
      errors.push('healthCheck.expectedStatus is required');
    }
    
    if (config.healthCheck.timeoutMs && config.healthCheck.timeoutMs < 100) {
      errors.push('healthCheck.timeoutMs should be at least 100ms');
    }
    
    if (config.healthCheck.checkIntervalMs && config.healthCheck.checkIntervalMs < 1000) {
      errors.push('healthCheck.checkIntervalMs should be at least 1000ms');
    }
  }
  
  // Check for required environment variables
  if (config.environmentVariables) {
    const missingVars = Object.entries(config.environmentVariables)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }
  
  // Check Vercel token
  if (!process.env.VERCEL_TOKEN) {
    errors.push('VERCEL_TOKEN environment variable is not set');
  }
  
  // Throw all validation errors at once
  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
  }
  
  console.log('✅ Environment configuration validated successfully');
}

export function runPreDeployChecks() {
  const errors: string[] = [];
  
  try {
    // Check if we're in a git repository
    if (isGitRepository()) {
      try {
        // Check for uncommitted changes
        const status = execSync('git status --porcelain').toString();
        if (status.trim()) {
          errors.push('Uncommitted changes detected. Commit or stash changes before deploying.');
        } else {
          console.log('✅ Git status check: No uncommitted changes');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push(`Git status check failed: ${errorMessage}`);
      }
    } else {
      console.log('⚠️ Not a git repository, skipping git checks');
    }

    // Check if package.json exists
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      // Check for required dependencies
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const requiredDeps = ['axios', 'commander'];
      
      const missingDeps = requiredDeps.filter(dep => 
        !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
      );
      
      if (missingDeps.length > 0) {
        errors.push(`Missing required dependencies: ${missingDeps.join(', ')}`);
      } else {
        console.log('✅ Dependencies check: All required dependencies found');
      }
      
      // Run tests if test script exists
      if (packageJson.scripts?.test && packageJson.scripts.test !== 'echo "Error: no test specified" && exit 1') {
        try {
          console.log('Running tests...');
          execSync('npm test', { stdio: 'inherit' });
          console.log('✅ Tests passed');
        } catch (error) {
          errors.push('Tests failed. Fix failing tests before deploying.');
        }
      } else {
        console.log('⚠️ No test script found, skipping tests');
      }
    } else {
      errors.push('package.json not found in current directory');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(`Pre-deployment checks error: ${errorMessage}`);
  }
  
  if (errors.length > 0) {
    throw new Error(`Pre-deployment checks failed:\n- ${errors.join('\n- ')}`);
  }
  
  console.log('✅ All pre-deployment checks passed');
}

function isGitRepository() {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
}