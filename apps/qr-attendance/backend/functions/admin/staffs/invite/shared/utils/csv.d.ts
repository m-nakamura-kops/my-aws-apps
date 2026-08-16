/**
 * CSVパース用の共通ロジック（1行パース・ヘッダー判定）
 */
/** CSVの1行をパース（カンマ区切り、ダブルクォート対応） */
export declare function parseCSVLine(line: string): string[];
/** ヘッダー行かどうか */
export declare function isHeaderRow(cells: string[]): boolean;
//# sourceMappingURL=csv.d.ts.map