// Copy this file to config.js and fill in your actual values
const config = {
    mongodb: {
        url: 'mongodb://localhost:27017/clearance_cursor'
    },
    azure: {
        computerVision: {
            endpoint: 'YOUR_COMPUTER_VISION_ENDPOINT',
            key: 'YOUR_COMPUTER_VISION_KEY'
        },
        openAI: {
            endpoint: 'YOUR_OPENAI_ENDPOINT',
            key: 'YOUR_OPENAI_KEY',
            deploymentName: 'YOUR_DEPLOYMENT_NAME'
        }
    }
};

module.exports = config; 