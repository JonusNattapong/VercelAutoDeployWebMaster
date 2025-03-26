import { Command } from 'commander';
import { deploy } from './index';
import { setupHealthMonitoring, checkDeploymentHealth } from './services/healthcheck.service';
import { validateEnvironment, runPreDeployChecks } from './services/validation.service';
import { getDeploymentStatus } from './services/vercel.service';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Spinner utility functions
function startSpinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  return setInterval(() => {
    process.stdout.write(`\r${frames[i = ++i % frames.length]} Deploying...`);
  }, 80);
}

function stopSpinner(spinner: NodeJS.Timeout) {
  clearInterval(spinner);
  process.stdout.write('\r');
}

const program = new Command();

program
  .name('vercel-autodeploy')
  .description('CLI for automated Vercel deployments with health monitoring')
  .version('1.0.0');

program.command('deploy <environment>')
  .description('Execute full deployment pipeline')
  .option('-y, --yes', 'Skip confirmation prompt', false)
  .option('-s, --skip-checks', 'Skip pre-deployment checks', false)
  .action(async (environment, options) => {
    try {
      if (!options.yes) {
        const confirmed = await confirmAction(`Are you sure you want to deploy to ${environment}? (y/n) `);
        if (!confirmed) {
          console.log('Deployment cancelled');
          process.exit(0);
        }
      }
      
      console.log(`\n📦 Starting deployment to ${environment}...\n`);
      
      const spinner = startSpinner();
      const url = await deploy(environment);
      stopSpinner(spinner);
      
      console.log(`\n✅ Deployment successful!`);
      console.log(`🌐 Deployment URL: ${url}`);
      console.log(`🔍 Health monitoring is active. Press Ctrl+C to stop.\n`);
      
      // Keep process running for health checks
      process.stdin.resume();
      process.on('SIGINT', () => {
        console.log('\nGracefully shutting down...');
        process.exit(0);
      });
    } catch (error) {
      let errorMessage = 'Deployment failed';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage += `: ${error}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage += `: ${String(error.message)}`;
      }
      console.error(`\n❌ ${errorMessage}`);
      process.exit(1);
    }
  });

program.command('validate <environment>')
  .description('Validate configuration without deploying')
  .action(async (environment) => {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'autodeploy.config.json'), 'utf-8'));
      const envConfig = config.environments[environment];
      
      if (!envConfig) {
        console.error(`❌ Environment "${environment}" not found in configuration`);
        process.exit(1);
      }
      
      console.log(`🔍 Validating configuration for ${environment}...`);
      validateEnvironment(envConfig);
      console.log('✅ Configuration is valid!');
      process.exit(0);
    } catch (error) {
      let errorMessage = 'Validation failed';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage += `: ${error}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage += `: ${String(error.message)}`;
      }
      console.error(`❌ ${errorMessage}`);
      process.exit(1);
    }
  });

program.command('healthcheck <url>')
  .description('Monitor deployment health status')
  .option('-i, --interval <ms>', 'check interval in milliseconds', '30000')
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', '5000')
  .option('-s, --status <code>', 'expected status code', '200')
  .action(async (url, options) => {
    console.log(`🔍 Starting health check for ${url}...`);
    console.log(`Interval: ${options.interval}ms, Timeout: ${options.timeout}ms, Expected status: ${options.status}`);
    
    const cleanup = setupHealthMonitoring(url, {
      expectedStatus: parseInt(options.status),
      timeoutMs: parseInt(options.timeout),
      checkIntervalMs: parseInt(options.interval)
    });

    process.on('SIGINT', () => {
      cleanup();
      console.log('\n🛑 Health check monitoring stopped');
      process.exit(0);
    });
    
    // Keep process running
    process.stdin.resume();
  });

program.command('check <url>')
  .description('Perform a one-time health check')
  .option('-t, --timeout <ms>', 'request timeout in milliseconds', '5000')
  .option('-s, --status <code>', 'expected status code', '200')
  .action(async (url, options) => {
    try {
      console.log(`🔍 Checking health of ${url}...`);
      const result = await checkDeploymentHealth(url, {
        expectedStatus: parseInt(options.status),
        timeoutMs: parseInt(options.timeout)
      });
      
      if (result.healthy) {
        console.log(`✅ Health check passed! Status: ${result.status}, Response time: ${result.responseTime}`);
        process.exit(0);
      } else {
        console.error(`❌ Health check failed! Status: ${result.status}${result.error ? `, Error: ${result.error}` : ''}`);
        process.exit(1);
      }
    } catch (error) {
      let errorMessage = 'Health check error';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage += `: ${error}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage += `: ${String(error.message)}`;
      }
      console.error(`❌ ${errorMessage}`);
      process.exit(1);
    }
  });

program.command('status <deployment-id>')
  .description('Check status of a Vercel deployment')
  .action(async (deploymentId) => {
    try {
      console.log(`🔍 Checking status of deployment ${deploymentId}...`);
      const status = await getDeploymentStatus(deploymentId);
      console.log(`📊 Deployment status: ${status}`);
      process.exit(0);
    } catch (error) {
      let errorMessage = 'Failed to get deployment status';
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage += `: ${error}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage += `: ${String(error.message)}`;
      }
      console.error(`❌ ${errorMessage}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

// Helper functions
function confirmAction(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}