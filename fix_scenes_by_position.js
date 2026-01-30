const fs = require('fs');
const path = 'c:/projects/momcast/public/templates/intro_template.json';

try {
    const t = JSON.parse(fs.readFileSync(path));
    let count = 0;

    console.log('🔍 Analyzing scenes WITHOUT solid layers...\n');

    const problematicScenes = ['사진12', '사진13', '사진14', '사진15', '사진16', '사진17', '사진21', '사진22', '사진23'];

    problematicScenes.forEach(sceneName => {
        const a = t.assets.find(asset => asset.nm === sceneName);
        if (!a || !a.layers || a.layers.length === 0) {
            console.log(`⚠️ ${sceneName}: Not found or no layers`);
            return;
        }

        // 중심 위치가 있는 레이어들 찾기
        const centeredLayers = a.layers.filter(l => {
            if (!l.ks || !l.ks.p || !l.ks.p.k) return false;
            const pos = l.ks.p.k;
            if (Array.isArray(pos) && pos.length >= 2) {
                const x = pos[0];
                const y = pos[1];
                // 세로(1080x1920): 중심 = (540, 960)
                // 가로(1920x1080): 중심 = (960, 540)
                return (Math.abs(x - 540) < 50 && Math.abs(y - 960) < 50) ||
                    (Math.abs(x - 960) < 50 && Math.abs(y - 540) < 50);
            }
            return false;
        });

        if (centeredLayers.length > 0) {
            // 첫 번째 중심 레이어로 판단
            const pos = centeredLayers[0].ks.p.k;
            const x = pos[0];
            const y = pos[1];

            let correctW, correctH, orientation;

            // Y가 더 크면 세로
            if (y > x) {
                correctW = 1080;
                correctH = 1920;
                orientation = 'VERTICAL';
            } else {
                correctW = 1920;
                correctH = 1080;
                orientation = 'HORIZONTAL';
            }

            if (a.w !== correctW || a.h !== correctH) {
                console.log(`🛠️ ${sceneName}: (${a.w || 'undefined'}x${a.h || 'undefined'} -> ${correctW}x${correctH}) [${orientation}]`);
                console.log(`   - Layer center position: (${x}, ${y})`);
                a.w = correctW;
                a.h = correctH;
                count++;
            } else {
                console.log(`✅ ${sceneName}: Already correct ${correctW}x${correctH} [${orientation}]`);
            }
        } else {
            console.log(`⚠️ ${sceneName}: No centered layers found (current: ${a.w}x${a.h})`);
        }
    });

    if (count > 0) {
        fs.writeFileSync(path, JSON.stringify(t));
        console.log(`\n✅ Saved ${count} corrections to intro_template.json`);
    } else {
        console.log('\n✨ No changes needed.');
    }
} catch (error) {
    console.error('❌ Error:', error);
}
