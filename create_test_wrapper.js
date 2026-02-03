const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

async function testRender() {
    console.log("🚀 Starting Local Test Render...");

    // Mock Project Data (Scene 20: comp_87 -> 07_Sequnce: comp_89)
    const projectData = {
        templateUrl: 'file://c:/projects/momcast/public/templates/meafteryou.json', // Use local file
        userImages: {
            // Test with placeholder or keep empty to rely on default assets
        },
        userTexts: {},
        requestId: 'test_local_1',
        scenes: [
            { id: 'comp_87', width: 1920, height: 1080 } // Scene 20
        ]
    };

    // Inject env var
    process.env.PROJECT_DATA = JSON.stringify(projectData);

    // Import main render logic (Assuming it's exported or we copy-paste mostly)
    // For simplicity, we'll implement a stripped down version that uses the SAME logic as render-server.js

    // ... [Copy core logic from render-server.js] ...
    // But since render-server.js takes env vars and runs on load, we might need to modify it or wrapper it.
    // Instead, let's just RUN render-server.js as a child process with crafted ENV.
}

// Create a wrapper script to run render-server.js with mocked env
const wrapperScript = `
const { execSync } = require('child_process');

process.env.PROJECT_DATA = JSON.stringify({
    templateUrl: 'http://localhost:3000/templates/meafteryou.json', // Need local server running
    scenes: [{ id: 'comp_87', width: 1920, height: 1080 }]
});

// We need a local server to serve the JSON/Images if using URL, 
// OR patch render-server to accept file://
// Given 'npm run dev' is running on port 3000, we can try localhost:3000.

try {
    execSync('node scripts/render/render-server.js', { stdio: 'inherit', env: process.env });
} catch (e) {
    console.error(e);
}
`;

fs.writeFileSync('test_render_wrapper.js', wrapperScript);
console.log("✅ Wrapper created. Run 'node test_render_wrapper.js'");
