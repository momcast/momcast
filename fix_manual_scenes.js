const fs = require('fs');
const path = 'c:/projects/momcast/public/templates/intro_template.json';

try {
    const t = JSON.parse(fs.readFileSync(path));

    // 수동으로 확인한 치수
    const manualFixes = {
        '사진12': { w: 1920, h: 1080 },
        '사진13': { w: 1080, h: 1920 },
        '사진14': { w: 1920, h: 1080 },
        '사진15': { w: 1080, h: 1920 },
        '사진16': { w: 1080, h: 1920 },
        '사진17': { w: 1080, h: 1920 },
        '사진21': { w: 1080, h: 1920 },
        '사진22': { w: 1080, h: 1920 },
    };

    console.log('🔧 Applying manual fixes for undefined/missing dimensions...\n');

    let count = 0;
    Object.entries(manualFixes).forEach(([name, dims]) => {
        const asset = t.assets.find(a => a.nm === name);
        if (asset) {
            const oldW = asset.w || 'undefined';
            const oldH = asset.h || 'undefined';

            if (asset.w !== dims.w || asset.h !== dims.h) {
                asset.w = dims.w;
                asset.h = dims.h;
                const orientation = dims.w === 1080 ? 'VERTICAL' : 'HORIZONTAL';
                console.log(`✅ ${name}: ${oldW}x${oldH} -> ${dims.w}x${dims.h} [${orientation}]`);
                count++;
            }
        }
    });

    if (count > 0) {
        fs.writeFileSync(path, JSON.stringify(t));
        console.log(`\n✅ Saved ${count} fixes to intro_template.json`);
    } else {
        console.log('\n✨ All target scenes already have correct dimensions.');
    }

    // 최종 확인
    console.log('\n📊 Final verification:');
    Object.keys(manualFixes).forEach(name => {
        const asset = t.assets.find(a => a.nm === name);
        if (asset) {
            console.log(`  ${name}: ${asset.w}x${asset.h}`);
        }
    });

} catch (error) {
    console.error('❌ Error:', error);
}
