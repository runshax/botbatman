// Indonesian Public Holidays 2026
// Source: Official Indonesian government calendar

const holidays2026 = [
  { date: '2026-01-01', name: 'Tahun Baru Masehi', nameEn: 'New Year' },
  { date: '2026-01-31', name: 'Tahun Baru Imlek 2577', nameEn: 'Chinese New Year' },
  { date: '2026-03-22', name: 'Isra Mi\'raj Nabi Muhammad SAW', nameEn: 'Isra Mi\'raj' },
  { date: '2026-03-23', name: 'Hari Suci Nyepi (Tahun Baru Saka 1948)', nameEn: 'Nyepi (Balinese New Year)' },
  { date: '2026-04-03', name: 'Wafat Isa Al-Masih', nameEn: 'Good Friday' },
  { date: '2026-04-05', name: 'Hari Paskah', nameEn: 'Easter Sunday' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional', nameEn: 'Labor Day' },
  { date: '2026-05-14', name: 'Kenaikan Isa Al-Masih', nameEn: 'Ascension Day' },
  { date: '2026-05-24', name: 'Hari Raya Waisak 2570', nameEn: 'Vesak Day' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila', nameEn: 'Pancasila Day' },
  { date: '2026-06-17', name: 'Hari Raya Idul Fitri 1447 H', nameEn: 'Eid al-Fitr' },
  { date: '2026-06-18', name: 'Hari Raya Idul Fitri 1447 H', nameEn: 'Eid al-Fitr' },
  { date: '2026-08-17', name: 'Hari Kemerdekaan RI', nameEn: 'Independence Day' },
  { date: '2026-08-24', name: 'Hari Raya Idul Adha 1447 H', nameEn: 'Eid al-Adha' },
  { date: '2026-09-13', name: 'Tahun Baru Islam 1448 H', nameEn: 'Islamic New Year' },
  { date: '2026-11-22', name: 'Maulid Nabi Muhammad SAW', nameEn: 'Mawlid' },
  { date: '2026-12-25', name: 'Hari Raya Natal', nameEn: 'Christmas' }
];

// You can add more years as needed
const holidays2027 = [
  { date: '2027-01-01', name: 'Tahun Baru Masehi', nameEn: 'New Year' },
  // Add 2027 holidays when they're officially announced
];

const allHolidays = [...holidays2026, ...holidays2027];

/**
 * Check if a given date is an Indonesian public holiday
 * @param {Date} date - The date to check
 * @returns {object|null} - Holiday object if it's a holiday, null otherwise
 */
const isHoliday = (date) => {
  const dateStr = formatDateToString(date);
  return allHolidays.find(holiday => holiday.date === dateStr) || null;
};

/**
 * Get today's holiday information
 * @returns {object|null} - Holiday object if today is a holiday, null otherwise
 */
const getTodayHoliday = () => {
  return isHoliday(new Date());
};

/**
 * Get tomorrow's holiday information
 * @returns {object|null} - Holiday object if tomorrow is a holiday, null otherwise
 */
const getTomorrowHoliday = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isHoliday(tomorrow);
};

/**
 * Get all holidays for a specific year
 * @param {number} year - The year to get holidays for
 * @returns {array} - Array of holiday objects
 */
const getHolidaysForYear = (year) => {
  return allHolidays.filter(holiday => holiday.date.startsWith(year.toString()));
};

/**
 * Get upcoming holidays (next 5 holidays from today)
 * @returns {array} - Array of upcoming holiday objects
 */
const getUpcomingHolidays = (count = 5) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return allHolidays
    .filter(holiday => new Date(holiday.date) >= today)
    .slice(0, count);
};

/**
 * Format date to YYYY-MM-DD string
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
const formatDateToString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date to Indonesian readable format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} - Formatted date in Indonesian format
 */
const formatDateIndonesian = (dateStr) => {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const [year, month, day] = dateStr.split('-');
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
};

module.exports = {
  isHoliday,
  getTodayHoliday,
  getTomorrowHoliday,
  getHolidaysForYear,
  getUpcomingHolidays,
  formatDateIndonesian
};
