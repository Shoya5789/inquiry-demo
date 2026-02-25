/**
 * 簡易PII（個人情報）マスキング
 * LLMに送信する前に適用する
 */
export function maskPII(text: string): string {
  return text
    // メールアドレス
    .replace(/[\w.+%-]+@[\w.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    // 日本の電話番号（ハイフンあり）
    .replace(/0\d{1,4}-\d{2,4}-\d{4}/g, '[PHONE]')
    // 電話番号（ハイフンなし）
    .replace(/0[789]0\d{8}/g, '[PHONE]')
    // 郵便番号
    .replace(/〒?\d{3}-\d{4}/g, '[POSTAL]')
    // マイナンバー風（12桁数字）
    .replace(/\b\d{12}\b/g, '[MYNUMBER]')
}
