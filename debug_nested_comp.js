const fs = require('fs');
const filePath = 'c:/projects/momcast/public/templates/meafteryou.json';

try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Scene 14 uses comp_45 -> Layout 1 refs comp_47
    // Let's inspect comp_47 and comp_46

    const targets = ['comp_47', 'comp_46'];

    targets.forEach(id => {
        const comp = json.assets.find(a => a.id === id);
        console.log(`\n\n--- Analyzing ${id} ---`);
        if (comp) {
            console.log(`Name: ${comp.nm}, W: ${comp.w}, H: ${comp.h}`);
            console.log(`Layers Count: ${comp.layers?.length}`);

            comp.layers.forEach((l, i) => {
                // Check if it's an image layer or ref
                let typeStr = l.ty;
                if (l.ty === 2) typeStr = 'Image';
                else if (l.ty === 0) typeStr = 'Precomp';
                else if (l.ty === 4) typeStr = 'Shape';
                else if (l.ty === 5) typeStr = 'Text';

                console.log(`  L${i} [${typeStr}]: nm=${l.nm}, refId=${l.refId}`);
            });
        } else {
            console.log('Not Found');
        }
    });

} catch (e) { console.error(e); }
