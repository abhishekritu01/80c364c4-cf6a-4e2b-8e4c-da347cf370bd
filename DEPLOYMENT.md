# Deploying to Vercel

This project has been configured to deploy on Vercel as serverless functions.

## Setup

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel
   ```
   
   For production deployment:
   ```bash
   vercel --prod
   ```

## Project Structure

- `api/` - Serverless functions (API routes)
  - `data-loader.js` - Shared module for loading CSV data
  - `health.js` - Health check endpoint (`/api/health`)
  - `devices.js` - List all devices (`/api/devices`)
  - `devices/[id]/savings.js` - Get device savings (`/api/devices/:id/savings`)
- `public/` - Static files (served at root)
  - `index.html` - Frontend application
- `data/` - CSV data files (must be included in deployment)

## Important Notes

1. **Data Files**: The CSV files in the `data/` directory must be committed to your repository and will be included in the deployment.

2. **Environment Variables**: Currently none are required, but if you need to add any, set them in the Vercel dashboard or using:
   ```bash
   vercel env add VARIABLE_NAME
   ```

3. **Function Timeout**: Functions are configured with a 30-second timeout (see `vercel.json`). If you need longer, you may need a Vercel Pro plan.

4. **Cold Starts**: The first request may be slower as the CSV files are loaded into memory. Subsequent requests in the same execution environment will use the cached data.

## Local Development

You can test the Vercel setup locally using:

```bash
vercel dev
```

This will start a local server that mimics Vercel's serverless environment.

## Troubleshooting

- If you get errors about missing files, ensure `data/` directory is included and not in `.gitignore`
- If routes return 404, check that API files are in the `api/` directory with correct naming
- Check Vercel function logs in the dashboard for detailed error messages

