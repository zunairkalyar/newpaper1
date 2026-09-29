const path = require('path');
const { NEWSPAPER_CATALOG } = require('./scrapers');

const dateStr = new Date().toISOString().split('T')[0];
const [year, month, day] = dateStr.split('-').map(Number);
const dateObj = {
    raw: dateStr,
    day,
    month,
    year,
    formatted: dateStr,
    fileDate: year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
};

const outputDir = path.join(__dirname, 'output');

async function testAll() {
    const testIds = [
        'brecorder',
        'dawn_khi',
        'ausaf_isb',
        'naibaat_lhr',
        'juraat_khi',
        'dailyaaj_pesh',
        'jobz_pk'
    ];

    for (let i = 0; i < testIds.length; i++) {
        const id = testIds[i];
        const item = NEWSPAPER_CATALOG.find(n => n.id === id);
            console.log('[TEST] Not found: ' + id);
            continue;
        }
        console.log('');
        console.log('========================================');
        console.log('[TEST] (' + (i+1) + '/' + testIds.length + ') Starting: ' + item.name + ' (' + item.id + ')');
        console.log('========================================');
        try {
            const res = await item.handler(
                dateObj,
                outputDir,
                { quality: 'standard' },
                (msg) => console.log('  [LOG] ' + msg)
            );
            console.log('[TEST] SUCCESS ' + item.name + ': ' + res.pages + ' pages, ' + res.sizeMb + ' MB -> ' + res.filename);
        } catch (err) {
            console.log('[TEST] FAILED ' + item.name + ': ' + err.message);
        }
    }
    console.log('[TEST] All tests completed!');
}

testAll();
