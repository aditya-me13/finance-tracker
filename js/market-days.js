/* ── Market calendar (NSE/BSE equity) ─────────────────────────
   Weekday trading holidays published by NSE. Saturdays and Sundays are always closed and are not
   listed. NSE publishes the next year's list each December: add it here when it is out (years not
   listed fall back to weekends only). Muhurat-trading days count as closed. */
const NSE_HOLIDAYS={
  '2024-01-22':'Special holiday','2024-01-26':'Republic Day','2024-03-08':'Mahashivratri','2024-03-25':'Holi',
  '2024-03-29':'Good Friday','2024-04-11':'Id-Ul-Fitr','2024-04-17':'Shri Ram Navami','2024-05-01':'Maharashtra Day',
  '2024-05-20':'General Elections (Mumbai)','2024-06-17':'Bakri Id','2024-07-17':'Muharram','2024-08-15':'Independence Day',
  '2024-10-02':'Mahatma Gandhi Jayanti','2024-11-01':'Diwali Laxmi Pujan','2024-11-15':'Guru Nanak Jayanti',
  '2024-11-20':'Maharashtra Assembly Elections','2024-12-25':'Christmas',

  '2025-02-26':'Mahashivratri','2025-03-14':'Holi','2025-03-31':'Id-Ul-Fitr','2025-04-10':'Shri Mahavir Jayanti',
  '2025-04-14':'Dr. Baba Saheb Ambedkar Jayanti','2025-04-18':'Good Friday','2025-05-01':'Maharashtra Day',
  '2025-08-15':'Independence Day','2025-08-27':'Ganesh Chaturthi','2025-10-02':'Mahatma Gandhi Jayanti / Dussehra',
  '2025-10-21':'Diwali Laxmi Pujan','2025-10-22':'Diwali Balipratipada','2025-11-05':'Guru Nanak Jayanti','2025-12-25':'Christmas',

  '2026-01-15':'Maharashtra Municipal Elections','2026-01-26':'Republic Day','2026-03-03':'Holi','2026-03-26':'Shri Ram Navami',
  '2026-03-31':'Shri Mahavir Jayanti','2026-04-03':'Good Friday','2026-04-14':'Dr. Baba Saheb Ambedkar Jayanti',
  '2026-05-01':'Maharashtra Day','2026-05-28':'Bakri Id','2026-06-26':'Muharram','2026-09-14':'Ganesh Chaturthi',
  '2026-10-02':'Mahatma Gandhi Jayanti','2026-10-20':'Dussehra','2026-11-10':'Diwali Balipratipada',
  '2026-11-24':'Guru Nanak Jayanti','2026-12-25':'Christmas',
};
/* Why the market is shut on iso ('Saturday', 'Sunday', a holiday name), or '' if it is a trading day */
function marketClosedReason(iso){
  if(!iso)return'';
  const wd=new Date(iso+'T00:00:00').getDay();
  if(wd===0)return'Sunday';
  if(wd===6)return'Saturday';
  return NSE_HOLIDAYS[iso]||'';
}
const isMarketOpen=iso=>!marketClosedReason(iso);
/* iso itself if the market is open, else the next trading day */
function nextMarketDay(iso){
  let d=iso,guard=0;
  while(!isMarketOpen(d)&&guard++<15){const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+1);d=dateToStr(x);}
  return d;
}
/* Date of SIP installment i (0 = the holding's date, 1 = a month earlier, ...): the same day of the
   month, moved to the next trading day when the market is closed */
const sipInstallmentDate=(baseIso,i)=>nextMarketDay(shiftDateMonths(baseIso,-i));
