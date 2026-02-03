const fs = require('fs');
const filePath = 'c:/projects/momcast/public/templates/meafteryou.json';

try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // We need to look deeper into the assets to see their layers and determine effective duration
    const targetIds = ['comp_88', 'comp_97'];

    targetIds.forEach(id => {
        const found = json.assets.find(a => a.id === id);
        if (found) {
            console.log(`\n[${id}] Name: ${found.nm}, Implicit Duration Analysis`);
            let maxLayerEnd = 0;
            if (found.layers) {
                found.layers.forEach((l, i) => {
                    const end = (l.op || 0);
                    if (end > maxLayerEnd) maxLayerEnd = end;
                    console.log(`  L${i}: st=${l.st}, op=${l.op}, refId=${l.refId}`);
                });
            }
            console.log(`  -> Estimated Duration: ${maxLayerEnd}`);
        }
    });

} catch (e) { console.error(e); }
