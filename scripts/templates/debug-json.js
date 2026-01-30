const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../public/templates/meafteryou.json');

try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log('--- Template Info ---');
    console.log('Name:', data.nm);
    console.log('Total Assets:', data.assets.length);
    console.log('Total Layers (Root):', data.layers.length);

    console.log('\n--- All Compositions with Layers ---');
    data.assets.forEach(a => {
        if (a.layers && a.layers.length > 0) {
            console.log(`- ID: ${a.id}, Name: "${a.nm || '(unnamed)'}", Layers: ${a.layers.length}`);
        }
    });

    console.log('\n--- Checking Sequnce pattern ---');
    data.assets.filter(a => a.nm && a.nm.includes('Sequnce')).forEach(a => {
        console.log(`- ID: ${a.id}, Name: "${a.nm}", Layers: ${a.layers ? a.layers.length : 0}`);
        if (a.layers) {
            a.layers.forEach((l, i) => console.log(`  [${i}] Layer: "${l.nm}", RefID: "${l.refId}"`));
        }
    });

} catch (e) {
    console.error('Error:', e.message);
}
