"use strict";
/**
 * CSVパース用の共通ロジック（1行パース・ヘッダー判定）
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCSVLine = parseCSVLine;
exports.isHeaderRow = isHeaderRow;
/** CSVの1行をパース（カンマ区切り、ダブルクォート対応） */
function parseCSVLine(line) {
    const result = [];
    let i = 0;
    while (i < line.length) {
        if (line[i] === '"') {
            let end = line.indexOf('"', i + 1);
            while (end !== -1 && line[end + 1] === '"') {
                end = line.indexOf('"', end + 2);
            }
            if (end === -1)
                end = line.length;
            result.push(line.slice(i + 1, end).replace(/""/g, '"'));
            i = end + 1;
            if (line[i] === ',')
                i++;
        }
        else {
            const comma = line.indexOf(',', i);
            if (comma === -1) {
                result.push(line.slice(i).trim());
                break;
            }
            result.push(line.slice(i, comma).trim());
            i = comma + 1;
        }
    }
    return result;
}
/** ヘッダー行かどうか */
function isHeaderRow(cells) {
    const first = (cells[0] || '').toLowerCase().trim();
    return first === 'email' || first === 'メール' || first === 'mail';
}
//# sourceMappingURL=csv.js.map