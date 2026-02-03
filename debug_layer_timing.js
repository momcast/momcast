const fs = require('fs');
const filePath = 'c:/projects/momcast/public/templates/meafteryou.json';

try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const sceneIds = ['Scene 14', 'Scene 15', 'Scene 16', 'Scene 17', 'Scene 18', 'Scene 19', 'Scene 20', 'Scene 21'];

    sceneIds.forEach(sceneId => {
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
            console.log(`\n[${sceneId}] ID: ${found.id} (Fr: ${json.fr}, OP: ${found.op})`);
            found.layers.forEach((l, i) => {
                console.log(`  L${i} (${l.nm}): st=${l.st}, ip=${l.ip}, op=${l.op}, sr=${l.sr}`);
            });
        }
    });
} catch (e) { console.error(e); }
