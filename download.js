const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mkdirp = require('mkdirp');
const AdmZip = require('adm-zip');

async function downloadFromUrl(url, file_path) {
    const writer = fs.createWriteStream(file_path);

    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    });
}

async function main() {
    try {
        await mkdirp(process.env.directory);
        await mkdirp(process.env.tmp_directory);

        const file_path = path.resolve(process.env.tmp_directory, process.env.filename);
        const target_path = process.env.directory;

        await downloadFromUrl(process.env.url, file_path);

        const zip = new AdmZip(file_path);
        zip.extractAllTo(target_path, true);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();