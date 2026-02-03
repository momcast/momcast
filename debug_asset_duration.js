const fs = require('fs');
const filePath = 'c:/projects/momcast/public/templates/meafteryou.json';

try {
    const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    // Check Scene 21 (comp_96)
    // L0 -> comp_88 (Text)
    // L1 -> comp_97 (Sequence)

    // We want to know the OP of (comp_88) and (comp_97)

    const targetIds = ['comp_88', 'comp_97', 'comp_89', 'comp_83', 'comp_75', 'comp_69', 'comp_58', 'comp_52', 'comp_47'];

    targetIds.forEach(id => {
        const found = json.assets.find(a => a.id === id);
        if (found) {
            console.log(`[${id}] Name: ${found.nm}, OP: ${found.op}, W: ${found.w}, H: ${found.h}`);
        } else {
            console.log(`[${id}] NOT FOUND`);
        }
    });

} catch (e) { console.error(e); }
