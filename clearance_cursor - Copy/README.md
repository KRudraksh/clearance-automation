# Clearance Automation

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the configuration template:
   ```bash
   cp config.template.js config.js
   ```
4. Edit `config.js` and fill in your:
   - MongoDB connection URL
   - Azure Computer Vision endpoint and key
   - Azure OpenAI endpoint, key, and deployment name
5. Start the server:
   ```bash
   node server.js
   ``` 