const formatDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

export const getPreviousTradingDate = (baseDate: Date = new Date()): string => {
  const date = new Date(baseDate);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 1);

  // 当前仅回避周末，后续如需严格对齐美股休市日可接入交易所日历。
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
    date.setUTCDate(date.getUTCDate() - 1);
  }

  return formatDate(date);
};
