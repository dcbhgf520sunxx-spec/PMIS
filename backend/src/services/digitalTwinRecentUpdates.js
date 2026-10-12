const timestamp = value => Date.parse(/Z$|[+-]\d{2}(?::?\d{2})?$/i.test(value) ? value : value.replace(' ', 'T') + '+08:00');
const RECENT_UPDATE_LIMIT = 5;

function recentTwinUpdates(records, asOf) {
    const end = timestamp(asOf), start = end - 7 * 24 * 60 * 60 * 1000;
    return records.filter(record => record.kind !== 'products' && timestamp(record.updatedAt) >= start && timestamp(record.updatedAt) <= end + 999)
        .sort((a, b) => timestamp(b.updatedAt) - timestamp(a.updatedAt));
}
module.exports = { recentTwinUpdates, RECENT_UPDATE_LIMIT };
