const fs = require('fs');
const path = require('path');
const http = require('http');
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
                '--disable-gpu',
                '--allow-file-access-from-files' // 로컬 파일 접근 허용
            ],
            headless: 'new' // 최신 headless 모드 사용
        });
        console.log("✅ Browser launched successfully");

        const page = await browser.newPage();

        // 브라우저 콘솔 로그 캡처
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error') console.error(`🔴 Browser Error: ${text}`);
            else if (type === 'warning') console.warn(`⚠️  Browser Warning: ${text}`);
            else console.log(`🌐 Browser Log: ${text}`);
        });

        // 페이지 에러 캡처
        page.on('pageerror', error => {
            console.error(`💥 Page Error: ${error.message}`);
        });

        await page.setViewport({ width: template.w, height: template.h });

        // 로컬 HTML 파일 생성 (CORS 문제 해결)
        const templateJson = JSON.stringify(template);
        console.log(`📦 Template size: ${templateJson.length} bytes (${(templateJson.length / 1024 / 1024).toFixed(2)} MB)`);

        const lottieCdn = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <script src="${lottieCdn}"></script>
</head>
<body style="margin:0; background:black;">
    <div id="lottie" style="width:${template.w}px;height:${template.h}px"></div>
    <script>
        const templateData = ${templateJson};
        
        console.log('Loading animation...');
        
        const animation = lottie.loadAnimation({
            container: document.getElementById('lottie'),
            renderer: 'canvas',
            loop: false,
            autoplay: false,
            animationData: templateData
        });
        
        console.log('loadAnimation called');
        
        animation.addEventListener('config_ready', () => {
            console.log('config_ready');
        });
        
        animation.addEventListener('data_ready', () => {
            console.log('data_ready');
        });
        
        animation.addEventListener('DOMLoaded', () => {
            console.log('DOMLoaded');
            try {
                const userImages = ${JSON.stringify(userImages || {})};
                const userTexts = ${JSON.stringify(userTexts || {})};
                animation.assets.forEach(asset => { 
                    if(userImages[asset.id]) { 
                        asset.p = userImages[asset.id]; 
                        asset.u = ''; 
                    } 
                });
                const searchLayers = (layers) => {
                    layers.forEach(layer => {
                        if (layer.t?.d?.k?.[0]?.s && userTexts[layer.nm]) {
                            layer.t.d.k[0].s.t = userTexts[layer.nm];
                        }
                        if (layer.layers) searchLayers(layer.layers);
                    });
                };
                searchLayers(animation.layers);
                window.isLottieReady = true;
                console.log('isLottieReady = true');
            } catch (err) {
                console.error('DOMLoaded error:', err.message);
           }
        });
        
        animation.addEventListener('data_failed', () => {
            console.error('data_failed');
        });
        
        animation.addEventListener('error', (err) => {
            console.error('error:', err);
        });
    </script>
</body>
</html>`;

        //HTML 파일로 저장
        const tempHtmlFile = path.join(__dirname, 'temp_render.html');
        fs.writeFileSync(tempHtmlFile, htmlContent);
        console.log(`💾 HTML saved to ${tempHtmlFile}`);

        // file:// URL로 접근
        const fileUrl = `file:///${tempHtmlFile.replace(/\\/g, '/')}`;
        console.log(`🌐 Loading ${fileUrl}`);

        await page.goto(fileUrl, { waitUntil: 'networkidle0', timeout: 120000 });
        console.log("⏳ Waiting for Lottie...");

        // 폴링
        let ready = false;
        const maxAttempts = 360; // 3분
        for (let i = 0; i < maxAttempts; i++) {
            try {
                ready = await page.evaluate(() => window.isLottieReady === true);
                if (ready) {
                    console.log(`✅ Ready after ${(i * 0.5).toFixed(1)}s`);
                    break;
                }
            } catch (err) {
                // continue
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!ready) {
            throw new Error('❌ Lottie init failed after 3min');
        }

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
