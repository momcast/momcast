const fs = require('fs');
const path = require('path');

const filePath = 'c:/projects/momcast/public/templates/meafteryou.json';

try {
    console.log('Loading JSON...');
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    console.log('JSON Loaded. Assets count:', json.assets?.length);

    const sceneIds = ['Scene 14', 'Scene 15', 'Scene 16', 'Scene 17', 'Scene 18', 'Scene 19', 'Scene 20', 'Scene 21'];

    sceneIds.forEach(sceneId => {
        console.log(`\n--- Analyzing ${sceneId} ---`);

        // Emulate findSceneComp logic
        let found = json.assets.find(a => a.id === sceneId || a.id.toLowerCase() === sceneId.toLowerCase());

        if (!found) {
            const cleanNum = sceneId.replace(/[^0-9]/g, '');
            if (cleanNum) {
                found = json.assets.find(a => {
                    const nm = (a.nm || '').toLowerCase();
                    return nm.includes(cleanNum) && (nm.includes('scene') || nm.includes('씬') || nm.includes('comp'));
                });
            }
        }

        if (found) {
            console.log(`[FOUND] ID: ${found.id}, Name: ${found.nm}`);
            console.log(`Layers: ${found.layers?.length}, Width: ${found.w}, Height: ${found.h}`);

            // Analyze first few layers to see if they are placeholders or refs
            if (found.layers && found.layers.length > 0) {
                found.layers.slice(0, 3).forEach((l, i) => {
                    console.log(`  Layer ${i}: Type=${l.ty}, RefId=${l.refId}, Name=${l.nm}`);
                });
            } else {
                console.log('  No Layers found!');
            }
        } else {
            console.log('[NOT FOUND]');
        }
    });

} catch (e) {
    console.error('Error:', e);
}
