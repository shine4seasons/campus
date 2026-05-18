# SePay Payment Confirmation Environment Configuration

## Setup Instructions

### 1. Environment Variables File

Create or update your `.env` file with the following SePay configuration:

```bash
# ============================================
# SEPAY PAYMENT CONFIGURATION
# ============================================

# Your SePay API Key
# - Get this from: https://dashboard.sepay.vn/
# - This key is NEVER exposed to the frontend
# - Keep this secure - treat like a password
# - Rotate periodically for security
SEPAY_API_KEY=your_actual_sepay_api_key_here

# Optional: SePay API endpoint (defaults to production)
# For sandbox testing: https://api.sandbox.sepay.vn/transactions
# For production: https://api.sepay.vn/transactions
# SEPAY_API_URL=https://api.sepay.vn

# Optional: Payment expiry time in minutes (default: 15)
# PAYMENT_EXPIRY_MINUTES=15

# Optional: Poll interval in milliseconds (frontend)
# PAYMENT_POLL_INTERVAL=3000
```

### 2. File Location

Place the `.env` file in the project root directory:

```
campus/
├── .env                      ← Create here
├── app.js
├── package.json
├── models/
├── controllers/
├── routes/
└── ... (other files)
```

### 3. Security - Git Ignore

Make sure `.env` is in `.gitignore` to prevent accidental commits:

```bash
# .gitignore

# Environment variables
.env
.env.local
.env.production.local

# Don't track these files
node_modules/
dist/
build/
.DS_Store
```

### 4. Verify Configuration

After setting up `.env`, verify it's loaded correctly:

```bash
# Check if .env file exists
ls -la .env

# Restart server
npm start

# Check server logs
# Should NOT print SEPAY_API_KEY (security)
# But should show "SePay API initialized" or similar
```

## Getting SePay API Key

### Step-by-Step

1. **Go to SePay Dashboard**
   - URL: https://dashboard.sepay.vn/
   - Login with your account

2. **Navigate to API Settings**
   - Click "Settings" or "API Keys"
   - Look for "API Key Management"

3. **Generate New API Key**
   - Click "Create API Key"
   - Name: "Smart Campus Marketplace"
   - Permissions: "Read Transactions"
   - Generate key

4. **Copy API Key**
   - Copy the full API key
   - Save in `.env` as `SEPAY_API_KEY`
   - Do NOT share this key

5. **Test Connection**
   ```bash
   # Verify SePay can be accessed with your key
   curl -X GET "https://api.sepay.vn/transactions" \
     -H "Authorization: Bearer YOUR_SEPAY_API_KEY"
   ```

## Environment Variables Reference

### Required

| Variable | Value | Example | Required |
|----------|-------|---------|----------|
| SEPAY_API_KEY | Your SePay API key | `sep_1234567890abcdef...` | ✅ Yes |

### Optional

| Variable | Value | Default | Purpose |
|----------|-------|---------|---------|
| SEPAY_API_URL | SePay API endpoint | `https://api.sepay.vn` | API endpoint |
| PAYMENT_EXPIRY_MINUTES | Expiry time in minutes | `15` | QR timeout |
| PAYMENT_POLL_INTERVAL | Poll interval in ms | `3000` | Frontend poll rate |

## Environment Examples

### Development Setup

```bash
# .env (development)
NODE_ENV=development
SEPAY_API_KEY=your_dev_sepay_key

# Optional: Use sandbox SePay
# SEPAY_API_URL=https://api.sandbox.sepay.vn
```

### Production Setup

```bash
# .env (production)
NODE_ENV=production
SEPAY_API_KEY=your_prod_sepay_key

# Required security settings
SESSION_SECRET=your_secret_key_here
MONGODB_URI=your_mongodb_connection_string
```

## Accessing Environment Variables in Code

### Backend (Node.js)

```javascript
// Get SePay API key
const SEPAY_API_KEY = process.env.SEPAY_API_KEY;

// Check if key is set
if (!SEPAY_API_KEY) {
  console.error('ERROR: SEPAY_API_KEY not set in .env file');
  process.exit(1);
}

// Use in fetch
const response = await fetch('https://api.sepay.vn/transactions', {
  headers: {
    'Authorization': `Bearer ${SEPAY_API_KEY}`
  }
});
```

### Frontend (NOT RECOMMENDED)

```javascript
// ❌ DON'T DO THIS - API key will be exposed
const SEPAY_API_KEY = process.env.REACT_APP_SEPAY_API_KEY;

// ✅ DO THIS INSTEAD - Call backend endpoint
const response = await fetch('/api/payments/:paymentId/check');
```

## Troubleshooting Environment Setup

### Issue: SEPAY_API_KEY is undefined

```bash
# Check if .env file exists
ls .env

# Check if file has correct content
cat .env | grep SEPAY_API_KEY

# If missing, add it to .env
echo "SEPAY_API_KEY=your_key" >> .env

# Restart server
npm start
```

### Issue: dotenv not loading .env

```bash
# Make sure dotenv is installed
npm list dotenv

# If not installed
npm install dotenv

# Make sure it's loaded in app.js (should be first line)
require('dotenv').config();
```

### Issue: API key works locally but not in production

```bash
# Check if .env file exists in production
ssh user@production-server
ls -la /path/to/campus/.env

# If missing, add it
echo "SEPAY_API_KEY=your_prod_key" >> .env

# Restart server
pm2 restart app
# or
systemctl restart nodejs-app
```

### Issue: SePay API returns 401 Unauthorized

```bash
# Verify API key is correct
echo $SEPAY_API_KEY

# Test API key with curl
curl -X GET "https://api.sepay.vn/transactions" \
  -H "Authorization: Bearer $SEPAY_API_KEY"

# If 401, generate new key in SePay dashboard
# Update .env with new key
# Restart server
```

## Deployment Options

### Using Environment Variables

#### Option 1: Upload .env file (Simple)
```bash
# Development
scp .env user@dev-server:/path/to/campus/.env

# Production  
scp .env user@prod-server:/path/to/campus/.env
```

#### Option 2: Use CI/CD Secrets (Secure)
```bash
# In CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
# Set SEPAY_API_KEY as a secret variable
# Pipeline will create .env or pass to process
```

#### Option 3: System Environment Variables
```bash
# Set in system/server environment
export SEPAY_API_KEY="your_key"

# Or in Docker
ENV SEPAY_API_KEY=your_key

# Or in systemd service
[Service]
Environment="SEPAY_API_KEY=your_key"
```

## Docker Setup

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Pass SEPAY_API_KEY as build arg or runtime env
ARG SEPAY_API_KEY
ENV SEPAY_API_KEY=$SEPAY_API_KEY

EXPOSE 3000

CMD ["npm", "start"]
```

### docker-compose.yml

```yaml
version: '3'
services:
  app:
    build:
      context: .
      args:
        SEPAY_API_KEY: ${SEPAY_API_KEY}
    environment:
      - SEPAY_API_KEY=${SEPAY_API_KEY}
      - NODE_ENV=production
    ports:
      - "3000:3000"
    volumes:
      - ./:/app
    depends_on:
      - mongo
  
  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"
```

### Run with environment

```bash
# Pass env variable to docker
docker run -e SEPAY_API_KEY="your_key" your-image

# Or use .env.docker file
docker --env-file .env.docker run your-image

# Or use docker-compose
SEPAY_API_KEY=your_key docker-compose up
```

## PM2 Setup (Production)

### ecosystem.config.js

```javascript
module.exports = {
  apps: [{
    name: 'smart-campus',
    script: './app.js',
    env: {
      NODE_ENV: 'production',
      SEPAY_API_KEY: process.env.SEPAY_API_KEY
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    instances: 'max',
    exec_mode: 'cluster'
  }]
};
```

### Start with PM2

```bash
# Load environment from .env
pm2 start ecosystem.config.js --env production

# Or pass directly
SEPAY_API_KEY=your_key pm2 start ecosystem.config.js
```

## Security Best Practices

### DO ✅

- ✅ Store SEPAY_API_KEY in .env (server-side only)
- ✅ Add .env to .gitignore
- ✅ Rotate API key periodically
- ✅ Use different keys for dev/staging/production
- ✅ Restrict API key permissions in SePay dashboard
- ✅ Log when API key is used (without printing full key)
- ✅ Monitor API key usage in SePay dashboard
- ✅ Enable IP whitelist in SePay dashboard

### DON'T ❌

- ❌ Never commit .env to git
- ❌ Never expose API key in frontend code
- ❌ Never log the full API key
- ❌ Never share API key via email/chat
- ❌ Never hardcode API key in code
- ❌ Never use same key for multiple environments
- ❌ Never give API key write permissions (read-only)
- ❌ Never disable IP whitelist in production

## Migration from Manual to Automatic

### If You Had Previous Setup

```bash
# Old endpoint (still works)
GET /api/payments/:id/status

# New endpoint (recommended)
GET /api/payments/:paymentId/check
```

### Gradual Migration

1. Keep old endpoint working
2. Add new endpoint alongside
3. Update frontend to use new endpoint
4. Monitor success rate
5. Deprecate old endpoint after 1-2 weeks
6. Remove old endpoint after migration complete

## Verification Checklist

- [ ] .env file created in project root
- [ ] SEPAY_API_KEY added to .env
- [ ] .env added to .gitignore
- [ ] Server restarted after .env update
- [ ] Can access payment check endpoint
- [ ] SePay API responds with 200 (not 401)
- [ ] Payments can be confirmed
- [ ] No errors in logs about missing env vars
- [ ] Payment code generation working
- [ ] QR codes generated correctly

## Next Steps

1. Create `.env` file with SEPAY_API_KEY
2. Verify environment is loaded
3. Test payment flow
4. Deploy to production
5. Monitor payment confirmations
6. Set up alerts for failures

See `SEPAY_POLLING_SETUP.md` for full setup guide.
