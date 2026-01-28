const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const projectData = JSON.parse(process.env.PROJECT_DATA || '{}');
const { template: initialTemplate, templateUrl, userImages, userTexts, requestId, contactInfo, projectName } = projectData;

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function render() {
    let finalTemplate = initialTemplate;

    // 만약 template 데이터가 직접 오지 않고 URL만 왔을 경우 fetch 시도
    if (!finalTemplate && templateUrl) {
        console.log(`🌐 Fetching template from URL: ${templateUrl}`);
        try {
            const res = await fetch(templateUrl, {
                headers: { 'User-Agent': 'Momcast-Render-Engine' }
            });
            if (!res.ok) {
                console.error(`❌ HTTP Error: ${res.status} ${res.statusText}`);
                throw new Error(`Failed to fetch template: ${res.statusText}`);
            }
            finalTemplate = await res.json();
            console.log("✅ Template fetched successfully (Size: " + JSON.stringify(finalTemplate).length + " bytes)");
        } catch (err) {
            console.error("❌ Template fetch error:", err.message);
            // 만약 localhost일 경우 경고 출력
            if (templateUrl.includes('localhost')) {
                console.error("⚠️ CRITICAL: GitHub Actions cannot access 'localhost'. Please set NEXT_PUBLIC_SITE_URL environment variable.");
            }
            process.exit(1);
        }
    }

    if (!finalTemplate) {
        console.error("❌ ERROR: No template data provided (neither template nor templateUrl).");
        process.exit(1);
    }

    const template = finalTemplate;

    console.log("🚀 Starting Cloud Rendering...");
    if (requestId) {
        console.log(`📌 Processing Request ID: ${requestId}`);
        if (supabase) {
            try {
                await supabase.from('requests').update({
                    render_status: 'processing',
                    updated_at: new Date().toISOString()
                }).eq('id', requestId);
            } catch (dbErr) {
                console.warn("⚠️ Database update warning (initial):", dbErr.message);
            }
        }
    }

    let browser;
    try {
        console.log("🌐 Launching Browser...");
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            headless: 'new' // 최신 headless 모드 사용
        });
        console.log("✅ Browser launched successfully");

        const page = await browser.newPage();
        await page.setViewport({ width: template.w, height: template.h });

        // 대용량 템플릿을 임시 파일로 저장 (HTML 인라인 파싱 문제 해결)
        const tempTemplateFile = path.join(__dirname, 'temp_template.json');
        fs.writeFileSync(tempTemplateFile, JSON.stringify(template));
        console.log(`💾 Template saved to temporary file (${JSON.stringify(template).length} bytes)`);

        // 페이지에 파일 서버 시작
        await page.setRequestInterception(true);
        page.on('request', (interceptedRequest) => {
            if (interceptedRequest.url().endsWith('/temp_template.json')) {
                interceptedRequest.respond({
                    status: 200,
                    contentType: 'application/json',
                    body: fs.readFileSync(tempTemplateFile)
                });
            } else {
                interceptedRequest.continue();
            }
        });

        const lottieCdn = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
        const htmlContent = `
        <html>
        <head><script src="${lottieCdn}"></script></head>
        <body style="margin:0; background:black;"><div id="lottie" style="width:${template.w}px;height:${template.h}px"></div>
        <script>
            // 파일 경로로 로드 (인라인 JSON 대신)
            const animation = lottie.loadAnimation({
                container: document.getElementById('lottie'),
                renderer: 'canvas',
                loop: false, autoplay: false,
                path: '/temp_template.json'
            });
            animation.addEventListener('DOMLoaded', () => {
                console.log('Lottie DOMLoaded event fired');
                const userImages = ${JSON.stringify(userImages || {})};
                const userTexts = ${JSON.stringify(userTexts || {})};
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
            animation.addEventListener('data_ready', () => {
                console.log('Lottie data_ready event fired');
            });
        </script></body></html>`;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 90000 });
        console.log("⏳ Waiting for Lottie animation to initialize...");
        await page.waitForFunction('window.isLottieReady === true', { timeout: 120000 });

        const framesDir = path.join(__dirname, 'frames');
        if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

        const totalFrames = template.op - template.ip;
        console.log(`📸 Rendering ${totalFrames} frames...`);
        let lastReportedProgress = -1;

        for (let i = 0; i < totalFrames; i++) {
            await page.evaluate((frame) => { window.animation.goToAndStop(frame, true); }, i);
            await page.screenshot({ path: path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });

            const currentProgress = Math.floor((i / totalFrames) * 100);
            if (currentProgress >= lastReportedProgress + 10 && requestId && supabase) {
                await supabase.from('requests').update({
                    render_progress: currentProgress,
                    updated_at: new Date().toISOString()
                }).eq('id', requestId);
                lastReportedProgress = currentProgress;
                console.log(`[Progress] ${currentProgress}%`);
            } else if (i % 50 === 0) {
                process.stdout.write('.'); // 점으로 진행 표시
            }
        }
        console.log("\n✅ All frames rendered.");
        await browser.close();

        const outputPath = path.join(process.cwd(), 'output.mp4');
        console.log("🎬 Encoding video with FFmpeg...");

        // 프레임 파일 확인
        const frameFiles = fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg'));
        console.log(`📸 Found ${frameFiles.length} frame files in ${framesDir}`);

        if (frameFiles.length === 0) {
            throw new Error("No frames were generated!");
        }

        // FFmpeg는 Unix 스타일 경로를 선호함 (Windows에서도)
        const framePattern = path.join(framesDir, 'frame_%05d.jpg').replace(/\\/g, '/');
        console.log(`🎥 FFmpeg input pattern: ${framePattern}`);

        execSync(`ffmpeg -framerate ${template.fr || 30} -i "${framePattern}" -c:v libx264 -pix_fmt yuv420p -y "${outputPath}"`);
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
            console.log(`🎥 Public Video URL: ${publicUrl}`);

            if (requestId) {
                await supabase.from('requests').update({
                    status: 'completed',
                    render_status: 'completed',
                    result_url: publicUrl,
                    video_url: publicUrl,
                    rendered_at: new Date().toISOString(),
                    render_progress: 100
                }).eq('id', requestId);
                console.log(`✅ Supabase status updated to 'completed'`);
            }
        }
    } catch (err) {
        console.error("❌ Rendering Process Error:", err);
        if (browser) await browser.close();
        if (supabase && requestId) {
            await supabase.from('requests').update({
                render_status: 'failed',
                updated_at: new Date().toISOString()
            }).eq('id', requestId);
        }
        process.exit(1);
    }
}
render().catch(err => { console.error("💥 Uncaught Exception:", err); process.exit(1); });
