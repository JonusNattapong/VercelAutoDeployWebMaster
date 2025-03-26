# Vercel Auto Deploy WebMaster

A CLI tool for automated Vercel deployments with health monitoring and analytics.

## Features

- Automated deployment to Vercel
- Environment configuration validation
- Health monitoring for deployments
- Deployment analytics and metrics
- Pre-deployment checks

## Installation

```bash
npm install -g vercel-autodeploy-webmaster
```

## Configuration

Create `autodeploy.config.json` in your project root:

```json
{
  "environments": {
    "preview": {
      "vercelProject": "your-project-preview",
      "apiBaseUrl": "https://api.preview.example.com",
      "environmentVariables": {
        "NODE_ENV": "development",
        "API_KEY": "preview-api-key"
      },
      "healthCheck": {
        "expectedStatus": 200,
        "timeoutMs": 10000,
        "checkIntervalMs": 30000
      },
      "analytics": {
        "trackingId": "your-analytics-id",
        "collectMetrics": true
      }
    },
    "production": {
      "vercelProject": "your-project-prod",
      "apiBaseUrl": "https://api.example.com",
      "environmentVariables": {
        "NODE_ENV": "production",
        "API_KEY": "production-api-key"
      },
      "healthCheck": {
        "expectedStatus": 200,
        "timeoutMs": 5000,
        "checkIntervalMs": 60000
      },
      "analytics": {
        "trackingId": "your-analytics-id",
        "collectMetrics": true
      }
    }
  }
}
```

## Usage

### Deploy to an environment
```bash
vercel-autodeploy deploy <environment> [options]
```

Options:
- `-y, --yes`: Skip confirmation prompt
- `-s, --skip-checks`: Skip pre-deployment checks

### Validate configuration
```bash
vercel-autodeploy validate <environment>
```

### Health monitoring
```bash
vercel-autodeploy healthcheck <url> [options]
```

Options:
- `-i, --interval <ms>`: Check interval in milliseconds (default: 30000)
- `-t, --timeout <ms>`: Request timeout in milliseconds (default: 5000)
- `-s, --status <code>`: Expected status code (default: 200)

### One-time health check
```bash
vercel-autodeploy check <url> [options]
```

### Check deployment status
```bash
vercel-autodeploy status <deployment-id>
```

## Requirements

- Node.js 14+
- Vercel CLI installed
- VERCEL_TOKEN environment variable set

## License

MIT