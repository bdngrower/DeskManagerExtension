const manifest = require('office-addin-manifest');

async function validate() {
    try {
        const report = await manifest.validateManifest('manifest.xml');
        console.log(JSON.stringify(report, null, 2));
    } catch (err) {
        console.error('Erro:', err);
    }
}

validate();
