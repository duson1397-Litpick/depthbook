// 시간 경과 표시 유틸
// ISO 문자열을 받아 "방금", "N분 전", "N시간 전", "N일 전", "YYYY.MM.DD" 형태로 변환

// ISO 날짜를 "YYYY.MM.DD" 형태로 변환
export function formatDate(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

// ISO 날짜를 상대 시간 문자열로 변환
// 1분 미만  → "방금"
// 1~59분   → "N분 전"
// 1~23시간 → "N시간 전"
// 1~6일    → "N일 전"
// 7일 이상  → "YYYY.MM.DD"
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60_000)
  if (min < 1) return '방금'
  if (min < 60) return `${min}분 전`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour}시간 전`
  const day = Math.floor(hour / 24)
  if (day < 7) return `${day}일 전`
  return formatDate(iso)
}
