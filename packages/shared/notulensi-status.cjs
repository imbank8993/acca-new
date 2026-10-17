/** Overall progress is derived only from the non-empty meeting points. */
function notulensiStatus(points) {
    if (!points.length) return 'Belum';
    if (points.every(point => point.status === 'Selesai')) return 'Selesai';
    if (points.every(point => point.status === 'Belum')) return 'Belum';
    return 'Proses';
}
module.exports = { notulensiStatus };
