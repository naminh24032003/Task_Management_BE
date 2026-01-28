const fs = require('fs');

const data = JSON.parse(fs.readFileSync(0, 'utf8'));

const spans = [];
data.batches.forEach(batch => {
    const serviceName = batch.resource.attributes.find(a => a.key === 'service.name')?.value?.stringValue || 'unknown';
    batch.scopeSpans.forEach(ss => {
        ss.spans.forEach(s => {
            spans.push({
                service: serviceName,
                name: s.name,
                startTime: BigInt(s.startTimeUnixNano),
                endTime: BigInt(s.endTimeUnixNano),
                durationMs: Number(BigInt(s.endTimeUnixNano) - BigInt(s.startTimeUnixNano)) / 1000000,
                spanId: s.spanId,
                parentSpanId: s.parentSpanId
            });
        });
    });
});

spans.sort((a, b) => Number(a.startTime - b.startTime));

console.log('Trace Tree:');
spans.forEach(s => {
    console.log(`[${s.service}] ${s.name} - Duration: ${s.durationMs.toFixed(2)}ms`);
});
