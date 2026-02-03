const fs = require('fs');
const filePath = 'c:/projects/momcast/public/templates/meafteryou.json';

try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Scene 20: comp_87 -> 07_Sequnce: comp_89
    // Find comp_89 and inspect its layers to find the background
    const targetId = 'comp_89';
    const comp = json.assets.find(a => a.id === targetId);

    if (comp) {
        console.log(`[${targetId}] Name: ${comp.nm}`);
        comp.layers.forEach((l, i) => {
            console.log(`  L${i} Type=${l.ty}, Name=${l.nm}, RefId=${l.refId}, st=${l.st}, op=${l.op}, ip=${l.ip}, ks.o=${JSON.stringify(l.ks?.o)}`);
            // Check if it is a video asset
            if (l.refId) {
                const asset = json.assets.find(a => a.id === l.refId);
                if (asset) {
                    console.log(`    -> RefAsset: Name=${asset.nm}, Path=${asset.p}`);
                }
            }
        });
    } else {
        console.log('comp_89 not found');
    }

} catch (e) { console.error(e); }
