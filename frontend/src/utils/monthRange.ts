export function getMonthRangeParams(selectedMonth: string) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate().toString().padStart(2, "0");

  return `from=${selectedMonth}-01&to=${selectedMonth}-${lastDay}`;
}
