const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const projectData = JSON.parse(process.env.PROJECT_DATA || '{}');
const { templateUrl, userImages, userTexts, requestId, contactInfo, projectName, scenes } = projectData;

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

// 씬을 작은 Lottie JSON으로 추출
function extractSceneTemplate(fullTemplate, sceneComp) {
    // 씬 컴포지션에서 사용하는 모든 assets 수집
    const usedAssetIds = new Set();

    function collectAssets(layers) {
        layers.forEach(layer => {
            if (layer.refId) usedAssetIds.add(layer.refId);
            if (layer.layers) collectAssets(layer.layers);
        });
    }

    collectAssets(sceneComp.layers);

    // 재귀적으로 중첩 assets 수집
    let prevSize = 0;
    while (usedAssetIds.size > prevSize) {
        prevSize = usedAssetIds.size;
        Array.from(usedAssetIds).forEach(id => {
            const asset = fullTemplate.assets.find(a => a.id === id);
            if (asset && asset.layers) {
                collectAssets(asset.layers);
            }
        });
    }

    // 필요한 assets만 포함
    const sceneAssets = fullTemplate.assets.filter(a => usedAssetIds.has(a.id));

    return {
        v: fullTemplate.v,
        fr: fullTemplate.fr,
        ip: 0,
        op: sceneComp.op - sceneComp.ip,
        w: sceneComp.w,
        h: sceneComp.h,
        nm: sceneComp.nm,
        ddd: 0,
        // [Fix] Inject fonts/chars to prevent text rendering crashes
        fonts: fullTemplate.fonts,
        chars: fullTemplate.chars,
        assets: sceneAssets,
        layers: sceneComp.layers
    };
}

async function updateProgress(progress) {
    if (supabase && requestId) {
        await supabase.from('requests').update({ render_progress: progress }).eq('id', requestId);
    }
}

async function render() {
    try {
        // 1. 전체 템플릿 다운로드
        console.log(`🌐 Fetching template from: ${templateUrl}`);
        const res = await fetch(templateUrl, {
            headers: { 'User-Agent': 'Momcast-Render-Engine' }
        });

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const fullTemplate = await res.json();
        console.log(`✅ Template fetched (${JSON.stringify(fullTemplate).length} bytes)`);

        // [Global Fix] Robust Recursive Dimension Injection & Unhide (Updated)
        let fixedParamsCount = 0;

        // 1. Recursive Fix Function
        const fixRecursive = (layers) => {
            if (!layers) return;
            layers.forEach(l => {
                // Force Unhide
                if (l.hd === true) l.hd = false;

                // Recurse into Asset
                if (l.refId) {
                    const asset = fullTemplate.assets.find(a => a.id === l.refId);
                    if (asset) {
                        // Fix asset dim again if missed
                        if (!asset.w || !asset.h) {
                            asset.w = 1920;
                            asset.h = 1080;
                            fixedParamsCount++;
                        }
                        if (asset.layers) fixRecursive(asset.layers);
                    }
                }
            });
        };

        // 2. Apply to Assets List (Base Fix)
        if (fullTemplate.assets) {
            fullTemplate.assets.forEach(a => {
                if (!a.w || !a.h) {
                    a.w = 1920;
                    a.h = 1080;
                    fixedParamsCount++;
                }
            });
        }

        // 3. Apply Recursive Fix to everything
        if (fullTemplate.layers) fixRecursive(fullTemplate.layers);
        if (fullTemplate.assets) fullTemplate.assets.forEach(a => {
            if (a.layers) fixRecursive(a.layers);
        });

        console.log(`🔧 Global Robust Fix: Dimensions injected & Hidden layers unlocked. Total Ops: ${fixedParamsCount}`);

        console.log(`\n📦 Received scene data:`, JSON.stringify(scenes));

        // 2. 씬 정보로 컴포지션 필터링
        let sceneComps = [];

        if (scenes && scenes.length > 0) {
            console.log(`\n📦 Using ${scenes.length} scenes from project data`);
            sceneComps = scenes.map(scene => {
                const comp = fullTemplate.assets.find(a => a.id === scene.id);
                if (!comp) {
                    console.warn(`⚠️ Scene composition not found: ${scene.id}`);
                }
                return comp;
            }).filter(c => c != null);
        } else {
            // Fallback: 모든 컴포지션 로그 출력
            console.log('\n📋 No scene data provided. All compositions:');
            fullTemplate.assets.forEach((a, idx) => {
                if (a.layers) {
                    console.log(`  [${idx}] ${a.nm} (id:${a.id}, w:${a.w}, h:${a.h}, layers:${a.layers.length})`);
                }
            });

            // layers를 가진 컴포지션만 사용
            sceneComps = fullTemplate.assets.filter(a => a.layers && a.layers.length > 0);
        }

        console.log(`\n🎬 Rendering ${sceneComps.length} scenes`);

        if (sceneComps.length === 0) {
            throw new Error('No scenes to render');
        }

        await updateProgress(5);

        // 3. Puppeteer 브라우저 시작
        const browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ],
            headless: 'new'
        });

        console.log("✅ Browser launched");

        const framesDir = path.join(__dirname, 'frames');
        if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir);

        const sceneVideos = [];

        // 4. 각 씬 개별 렌더링
        for (let i = 0; i < sceneComps.length; i++) {
            const sceneComp = sceneComps[i];
            console.log(`\n🎬 Rendering scene ${i + 1}/${sceneComps.length}: ${sceneComp.nm}`);

            // 씬 템플릿 추출 (작은 JSON)
            const sceneTemplate = extractSceneTemplate(fullTemplate, sceneComp);

            // 전달받은 씬 정보(API)에 치수가 있으면 사용 (Lottie에 누락된 경우 대비)
            const inputScene = scenes.find(s => s.id === sceneComp.id);
            if (inputScene && inputScene.width && inputScene.height) {
                console.log(`  🔧 Overriding dimensions from input: ${inputScene.width}x${inputScene.height}`);
                sceneTemplate.w = inputScene.width;
                sceneTemplate.h = inputScene.height;
            }

            const sceneJson = JSON.stringify(sceneTemplate);
            console.log(`  📦 Scene template size: ${sceneJson.length} bytes (${(sceneJson.length / 1024).toFixed(1)}KB)`);
            console.log(`  📐 Scene dimensions: ${sceneTemplate.w}x${sceneTemplate.h} (${sceneTemplate.w > sceneTemplate.h ? 'landscape' : 'portrait'})`);

            // 새 페이지
            const page = await browser.newPage();
            // 치수가 없으면 기본값 사용 (방어 코드)
            const viewWidth = sceneTemplate.w || 1920;
            const viewHeight = sceneTemplate.h || 1080;
            await page.setViewport({ width: viewWidth, height: viewHeight });

            // HTML 생성
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
</head>
<body style="margin:0; background:black;">
    <div id="lottie" style="width:${sceneTemplate.w}px;height:${sceneTemplate.h}px"></div>
    <script>
        const animation = lottie.loadAnimation({
            container: document.getElementById('lottie'),
            renderer: 'canvas',
            loop: false,
            autoplay: false,
            rendererSettings: {
                clearCanvas: true, // [Fix] SVG Artifact 방지
                preserveAspectRatio: 'xMidYMid slice'
            },
            animationData: ${sceneJson}
        });
        
            animation.addEventListener('DOMLoaded', () => {
                const userImages = ${JSON.stringify(userImages || {})};
                const userTexts = ${JSON.stringify(userTexts || {})};
                
                animation.assets.forEach(asset => {
                    // [Fix] Smart Asset Mapping (vid_N -> img_N)
                    // 프리뷰와 동일한 로직을 적용하여 배경 누락 방지
                    if (asset.p && typeof asset.p === 'string') {
                        const lowerP = asset.p.toLowerCase();
                        
                        if (lowerP.endsWith('.mp4') || lowerP.endsWith('.mov')) {
                            const match = lowerP.match(/vid_(\d+)/) || lowerP.match(/img_(\d+)/); 
                            asset.u = ''; // 로컬/상대 경로 사용
                            if (match && match[1]) {
                                asset.p = \`/templates/images/img_\${match[1]}.jpg\`;
                            } else {
                                // Default Fallback
                                asset.p = '/templates/images/img_1.jpg';
                            }
                        }
                         // 이미지 경로 정규화
                        else if (!lowerP.startsWith('data:') && !lowerP.startsWith('http')) {
                            asset.u = '';
                            asset.p = \`/templates/images/\${asset.p.split('/').pop()}\`;
                        }
                    }

                    // User Image Injection
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
        });
    </script>
</body>
</html>`;

            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

            // Lottie 준비 대기
            await page.waitForFunction('window.isLottieReady === true', { timeout: 60000 });
            console.log(`  ✅ Lottie ready`);

            // 프레임 렌더링
            const sceneFramesDir = path.join(framesDir, `scene${i}`);
            if (!fs.existsSync(sceneFramesDir)) fs.mkdirSync(sceneFramesDir);

            const totalFrames = sceneTemplate.op;
            console.log(`  📸 Rendering ${totalFrames} frames...`);

            for (let frame = 0; frame < totalFrames; frame++) {
                await page.evaluate((f) => {
                    window.lottie.renderers[0].renderFrame(f);
                }, frame);

                await page.screenshot({ path: path.join(sceneFramesDir, `frame_${String(frame).padStart(5, '0')}.png`) });

                if (frame % 30 === 0 || frame === totalFrames - 1) {
                    const sceneProgress = ((i + (frame / totalFrames)) / sceneComps.length) * 95;
                    await updateProgress(5 + sceneProgress);
                }
            }

            console.log(`  ✅ ${totalFrames} frames rendered`);

            // FFmpeg로 씬 비디오 생성
            const sceneVideo = path.join(__dirname, `scene${i}.mp4`);
            execSync(`ffmpeg -y -framerate ${sceneTemplate.fr} -i "${sceneFramesDir}/frame_%05d.png" -c:v libx264 -pix_fmt yuv420p "${sceneVideo}"`, { stdio: 'inherit' });

            sceneVideos.push(sceneVideo);

            // 프레임 정리
            fs.rmSync(sceneFramesDir, { recursive: true, force: true });

            await page.close();

            console.log(`  ✅ Scene video created`);
        }

        await browser.close();

        // 5. 씬 비디오 합치기
        console.log(`\n🎬 Merging ${sceneVideos.length} scene videos...`);

        const concatFile = path.join(__dirname, 'concat.txt');
        fs.writeFileSync(concatFile, sceneVideos.map(v => `file '${v.replace(/\\/g, '/')}'`).join('\n'));

        const finalVideo = path.join(__dirname, 'final.mp4');
        execSync(`ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${finalVideo}"`, { stdio: 'inherit' });

        console.log(`✅ Final video created: ${finalVideo}`);

        await updateProgress(100);

        // 정리
        sceneVideos.forEach(v => fs.unlinkSync(v));
        fs.unlinkSync(concatFile);
        fs.rmSync(framesDir, { recursive: true, force: true });

        console.log('🎉 Rendering complete!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Rendering failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

render();
