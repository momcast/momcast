const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');

const projectData = JSON.parse(process.env.PROJECT_DATA || '{}');
const { template, userImages, userTexts } = projectData;

if (!template) {
    console.error("No template data provided.");
    process.exit(1);
}

async function render() {
    console.log("🚀 Starting Cloud Rendering...");
    const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: template.w, height: template.h });

    const lottieCdn = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
    const htmlContent = `
    <html>
    <head><script src="${lottieCdn}"></script></head>
    <body style="margin:0"><div id="lottie" style="width:${template.w}px;height:${template.h}px"></div>
    <script>
        const animation = lottie.loadAnimation({
            container: document.getElementById('lottie'),
            renderer: 'canvas',
            loop: false, autoplay: false,
            animationData: ${JSON.stringify(template)}
        });
        animation.addEventListener('DOMLoaded', () => {
            const userImages = ${JSON.stringify(userImages)};
            const userTexts = ${JSON.stringify(userTexts)};
            animation.assets.forEach(asset => { if(userImages[asset.id]) { asset.p = userImages[asset.id]; asset.u = ''; } });
            const searchLayers = (layers) => {
                layers.forEach(layer => {
                    if (layer.t?.d?.k?.[0]?.s && userTexts[layer.nm]) layer.t.d.k[0].s.t = userTexts[layer.nm];
                    if (layer.layers) searchLayers(layer.layers);
                });
            };
            searchLayers(animation.layers);
            window.isLottieReady = true;
        });
    </script></body></html>`;

    await page.setContent(htmlContent);
    await page.waitForFunction('window.isLottieReady === true');

    const framesDir = path.join(__dirname, 'frames');
    if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

    const totalFrames = template.op - template.ip;
    for (let i = 0; i < totalFrames; i++) {
        await page.evaluate((frame) => { window.animation.goToAndStop(frame, true); }, i);
        await page.screenshot({ path: path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
        if (i % 30 === 0) console.log(`Progress: ${i}/${totalFrames}`);
    }
    await browser.close();

    try {
        execSync(`ffmpeg -framerate ${template.fr || 30} -i scripts/render/frames/frame_%05d.jpg -c:v libx264 -pix_fmt yuv420p -y output.mp4`);
        console.log("✅ Complete: output.mp4");
    } catch (err) { console.error("FFmpeg Error:", err); }
}
render().catch(err => { console.error(err); process.exit(1); });
