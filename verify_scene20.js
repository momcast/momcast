const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const fetch = require('node-fetch');

async function captureScene20() {
    console.log("📸 Capturing Scene 20 Frame 0 for Verification...");

    const templateUrl = 'http://localhost:3000/templates/meafteryou.json';
    const sceneId = 'comp_87'; // Scene 20

    // Fetch Template
    const res = await fetch(templateUrl);
    const fullTemplate = await res.json();

    // Find Scene Comp
    const sceneComp = fullTemplate.assets.find(a => a.id === sceneId);
    if (!sceneComp) throw new Error(`Scene ${sceneId} not found`);

    // Extract Logic (Simplified)
    const sceneTemplate = {
        v: fullTemplate.v,
        fr: fullTemplate.fr,
        ip: 0,
        op: sceneComp.op - sceneComp.ip,
        w: 1920,
        h: 1080,
        nm: sceneComp.nm,
        // [Fix] Inject Fonts & Chars to avoid crash
        fonts: fullTemplate.fonts,
        chars: fullTemplate.chars,
        assets: fullTemplate.assets, // Use all assets to be safe/lazy for verif
        layers: sceneComp.layers
    };

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // [Debug] Capture Logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));

    await page.setViewport({ width: 1920, height: 1080 });

    const htmlContent = `
    <html>
    <head><script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script></head>
    <body style="margin:0;background:black;">
        <div id="lottie"></div>
        <script>
            console.log("Starting Lottie Load...");
            try {
                const anim = lottie.loadAnimation({
                    container: document.getElementById('lottie'),
                    renderer: 'canvas',
                    loop: false,
                    autoplay: false,
                    rendererSettings: { clearCanvas: true, preserveAspectRatio: 'xMidYMid slice' },
                    animationData: ${JSON.stringify(sceneTemplate)}
                });

                anim.addEventListener('DOMLoaded', () => {
                    console.log("DOMLoaded Fired");
                    // [CRITICAL] Smart Asset Mapping Verification
                    anim.assets.forEach(asset => {
                        if (asset.p && typeof asset.p === 'string') {
                            const lowerP = asset.p.toLowerCase();
                            if (lowerP.endsWith('.mp4') || lowerP.endsWith('.mov')) {
                                const match = lowerP.match(/vid_(\\d+)/);
                                if (match && match[1]) {
                                     // Fix: Use Absolute Localhost URL
                                     asset.p = 'http://localhost:3000/templates/images/img_' + match[1] + '.jpg';
                                     asset.u = '';
                                     console.log('Remapped:', asset.id, 'to', asset.p);
                                }
                            }
                        }
                    });
                    
                    // Preload Images manually to avoid rendering blank
                    const images = anim.assets.filter(a => a.p && !a.layers).map(a => {
                        // Ensure full URL if not already
                        return a.p.startsWith('http') ? a.p : 'http://localhost:3000' + a.p;
                    });
                    
                    Promise.all(images.map(src => {
                        return new Promise(resolve => {
                            const img = new Image();
                            img.src = src;
                            img.onload = () => { console.log('Loaded:', src); resolve(); };
                            img.onerror = () => { console.error('Failed:', src); resolve(); }; // Continue anyway
                        });
                    })).then(() => {
                        console.log("All Images Processed");
                        // Render Frame 0 manually just to be sure
                        anim.goToAndStop(0, true);
                        window.isReady = true;
                    });
                });
                
                anim.addEventListener('data_failed', () => console.error("Data Failed"));
                anim.addEventListener('error', (e) => console.error("Lottie Error", e));
                
            } catch(e) {
                console.error("Script Error", e);
            }
        </script>
    </body>
    </html>
    `;

    await page.setContent(htmlContent);
    await page.waitForFunction('window.isReady === true', { timeout: 60000 });

    // Slight delay to ensure canvas paint
    await new Promise(r => setTimeout(r, 2000));

    // Capture
    await page.screenshot({ path: 'verification_scene20.png', fullPage: true });

    await browser.close();
    console.log("✅ Screenshot saved: verification_scene20.png");
}

captureScene20().catch(e => {
    console.error(e);
    process.exit(1);
});
