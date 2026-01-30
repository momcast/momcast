const fs = require('fs');
const path = 'c:/projects/momcast/public/templates/intro_template.json';

try {
    const t = JSON.parse(fs.readFileSync(path));
    let count = 0;

    console.log('🔍 Complete scene dimension audit...\n');

    const report = [];

    t.assets.forEach(a => {
        // 사진* 이름을 가진 모든 Asset 검사
        if (!a.nm || !a.nm.includes('사진')) return;

        if (a.layers && a.layers.length > 0) {
            // Solid Layer (ty: 1) 찾기 - 가장 정확한 캔버스 크기
            const solidLayer = a.layers.find(l => l.ty === 1 && l.sw && l.sh);

            if (solidLayer) {
                const correctW = solidLayer.sw;
                const correctH = solidLayer.sh;
                const orientation = correctW === 1080 && correctH === 1920 ? 'VERTICAL' : 'HORIZONTAL';

                // 현재 값과 다르면 수정
                if (a.w !== correctW || a.h !== correctH) {
                    console.log(`🛠️ Fixed: ${a.nm} (${a.w || 'undefined'}x${a.h || 'undefined'} -> ${correctW}x${correctH}) [${orientation}]`);
                    a.w = correctW;
                    a.h = correctH;
                    count++;
                }

                report.push({ name: a.nm, w: correctW, h: correctH, orientation });
            } else {
                console.log(`⚠️ No Solid Layer: ${a.nm}`);
            }
        }
    });

    // 리포트 출력
    console.log('\n📊 Final Scene Dimensions Report:');
    console.log('VERTICAL (1080x1920):');
    report.filter(r => r.orientation === 'VERTICAL').forEach(r => {
        console.log(`  - ${r.name}: ${r.w}x${r.h}`);
    });
    console.log('\nHORIZONTAL (1920x1080):');
    report.filter(r => r.orientation === 'HORIZONTAL').forEach(r => {
        console.log(`  - ${r.name}: ${r.w}x${r.h}`);
    });

    if (count > 0) {
        fs.writeFileSync(path, JSON.stringify(t));
        console.log(`\n✅ Saved ${count} corrections to intro_template.json`);
    } else {
        console.log('\n✨ All dimensions are correct.');
    }
} catch (error) {
    console.error('❌ Error:', error);
}
