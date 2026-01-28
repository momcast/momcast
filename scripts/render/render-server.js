const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const projectData = JSON.parse(process.env.PROJECT_DATA || '{}');
const { template, userImages, userTexts, requestId, contactInfo, projectName } = projectData;

if (!template) {
    console.error("No template data provided.");
    process.exit(1);
}

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function render() {
    console.log("🚀 Starting Cloud Rendering...");
    if (requestId) {
        console.log(`📌 Processing Request ID: ${requestId}`);
        if (supabase) {
            await supabase.from('requests').update({ status: 'processing' }).eq('id', requestId);
        }
    }

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
        const outputPath = path.join(process.cwd(), 'output.mp4');
        execSync(`ffmpeg -framerate ${template.fr || 30} -i scripts/render/frames/frame_%05d.jpg -c:v libx264 -pix_fmt yuv420p -y "${outputPath}"`);
        console.log(`✅ Complete: ${outputPath}`);

        if (supabase && fs.existsSync(outputPath)) {
            console.log("📤 Uploading to Supabase Storage...");
            const fileName = `render_${requestId || Date.now()}_${Math.floor(Math.random() * 1000)}.mp4`;
            const fileBuffer = fs.readFileSync(outputPath);

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('renders')
                .upload(fileName, fileBuffer, { contentType: 'video/mp4' });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('renders').getPublicUrl(fileName);
            console.log(`🎥 Video URL: ${publicUrl}`);

            if (requestId) {
                await supabase.from('requests').update({
                    status: 'completed',
                    result_url: publicUrl
                }).eq('id', requestId);
                console.log(`✅ Supabase Status Updated for request ${requestId}`);

                // Send Notification (Optional trigger)
                if (contactInfo) {
                    console.log(`[Notification] Completion alert would be sent to ${contactInfo}`);
                    // In a real environment, you might hit a webhook or internal API
                }
            }
        }
    } catch (err) {
        console.error("Rendering Process Error:", err);
        if (supabase && requestId) {
            await supabase.from('requests').update({ status: 'pending' }).eq('id', requestId);
        }
        process.exit(1);
    }
}
render().catch(err => { console.error(err); process.exit(1); });
