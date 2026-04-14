'use client'

// 캠페인 리포트 페이지
// 리뷰어들의 익명 피드백, 하이라이트, 별점을 한눈에 보는 리포트
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { colors, styles } from '@/lib/design'
import Logo from '@/components/Logo'

// 설문 응답 형태
interface Survey {
  one_liner: string | null
  good_points: string | null
  bad_points: string | null
  rating: number | null
  recommend_level: number | null
  target_reader: string | null
}

// 하이라이트 형태
interface Highlight {
  text: string
  chapter_label: string | null
  created_at: string
  campaign_reviewer_id: string | null
}

// 장르 비교용 캠페인 통계 형태
interface GenreStats {
  title: string
  avgRating: number | null
  avgRecommend: number | null
  wtrCount: number
  isCurrent: boolean
}

// 열람 기록 형태 (reading_sessions 테이블)
interface ReadingSession {
  chapter_index: number
  chapter_label: string | null
  duration_seconds: number
  campaign_reviewer_id: string
}

// 숫자를 소수점 한 자리까지 표시 (예: 4.166... → "4.2")
function formatScore(value: number): string {
  return value.toFixed(1)
}

// 배열에서 null 제외하고 평균 계산
function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

// null이 아닌 문자열만 추려냄
function filterText(values: (string | null)[]): string[] {
  return values.filter((v): v is string => !!v && v.trim() !== '')
}

export default function CampaignReportPage({ params }: { params: { id: string } }) {
  const campaignId = params.id
  const router = useRouter()
  const supabase = createClient()

  // 인증 확인 중 여부
  const [authChecking, setAuthChecking] = useState(true)

  // 캠페인 제목
  const [campaignTitle, setCampaignTitle] = useState('')

  // 설문 응답 목록
  const [surveys, setSurveys] = useState<Survey[]>([])

  // 하이라이트 목록
  const [highlights, setHighlights] = useState<Highlight[]>([])

  // 읽고 싶다 수
  const [wtrCount, setWtrCount] = useState(0)

  // 리뷰어 수 (전체 / 완료)
  const [totalReviewers, setTotalReviewers] = useState(0)
  const [completedReviewers, setCompletedReviewers] = useState(0)

  // 모바일 여부 (768px 미만)
  const [isMobile, setIsMobile] = useState(false)

  // 뒤로 버튼 호버 상태
  const [backHover, setBackHover] = useState(false)

  // 열람 기록 목록
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([])

  // 장르 비교 통계 목록
  const [genreStats, setGenreStats] = useState<GenreStats[]>([])

  // 화면 너비 감지
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const init = async () => {
      // 로그인 상태 확인
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/publisher/login')
        return
      }

      // 캠페인 정보 조회
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single()

      // 존재하지 않거나 내 캠페인이 아니면 대시보드로 이동
      if (!campaign || campaign.publisher_id !== user.id) {
        router.push('/publisher/dashboard')
        return
      }

      setCampaignTitle(campaign.title)
      setAuthChecking(false)

      // 설문 응답 조회
      const { data: surveyData } = await supabase
        .from('surveys')
        .select('one_liner, good_points, bad_points, rating, recommend_level, target_reader')
        .eq('campaign_id', campaignId)

      setSurveys(surveyData ?? [])

      // 하이라이트 조회 (리뷰어 구분을 위해 campaign_reviewer_id 포함)
      const { data: highlightData } = await supabase
        .from('highlights')
        .select('text, chapter_label, created_at, campaign_reviewer_id')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: true })

      setHighlights(highlightData ?? [])

      // 읽고 싶다 수 조회
      const { count: wtr } = await supabase
        .from('want_to_read')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)

      setWtrCount(wtr ?? 0)

      // 리뷰어 전체 수 (승인 이상)
      const { count: total } = await supabase
        .from('campaign_reviewers')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .in('status', ['accepted', 'reading', 'completed'])

      setTotalReviewers(total ?? 0)

      // 설문 완료 수
      const { count: completed } = await supabase
        .from('campaign_reviewers')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('status', 'completed')

      setCompletedReviewers(completed ?? 0)

      // 열람 기록 조회
      const sessionRes = await fetch(`/api/reading-session?campaignId=${campaignId}`)
      if (sessionRes.ok) {
        const { sessions } = await sessionRes.json()
        setReadingSessions(sessions ?? [])
      }

      // 장르 비교 조회 — 같은 장르의 내 다른 캠페인들과 비교
      if (campaign.genre) {
        const { data: sameGenre } = await supabase
          .from('campaigns')
          .select('id, title')
          .eq('genre', campaign.genre)
          .eq('publisher_id', user.id)
          .in('status', ['active', 'completed'])

        const siblings = sameGenre ?? []
        if (siblings.length > 1 || (siblings.length === 1 && siblings[0].id !== campaignId)) {
          // 각 캠페인의 설문 평균 + 읽고 싶다 수를 한꺼번에 조회
          const ids = siblings.map((c: { id: string }) => c.id)

          const { data: allSurveys } = await supabase
            .from('surveys')
            .select('campaign_id, rating, recommend_level')
            .in('campaign_id', ids)

          const { data: allWtr } = await supabase
            .from('want_to_read')
            .select('campaign_id')
            .in('campaign_id', ids)

          // campaign_id별로 집계
          const surveyMap = new Map<string, { ratings: number[]; recommends: number[] }>()
          for (const s of allSurveys ?? []) {
            if (!surveyMap.has(s.campaign_id)) {
              surveyMap.set(s.campaign_id, { ratings: [], recommends: [] })
            }
            const entry = surveyMap.get(s.campaign_id)!
            if (s.rating !== null) entry.ratings.push(s.rating)
            if (s.recommend_level !== null) entry.recommends.push(s.recommend_level)
          }

          const wtrMap = new Map<string, number>()
          for (const w of allWtr ?? []) {
            wtrMap.set(w.campaign_id, (wtrMap.get(w.campaign_id) ?? 0) + 1)
          }

          const stats: GenreStats[] = siblings.map((c: { id: string; title: string }) => {
            const sm = surveyMap.get(c.id) ?? { ratings: [], recommends: [] }
            const avgR = sm.ratings.length
              ? sm.ratings.reduce((a: number, b: number) => a + b, 0) / sm.ratings.length
              : null
            const avgRec = sm.recommends.length
              ? sm.recommends.reduce((a: number, b: number) => a + b, 0) / sm.recommends.length
              : null
            return {
              title: c.title,
              avgRating: avgR,
              avgRecommend: avgRec,
              wtrCount: wtrMap.get(c.id) ?? 0,
              isCurrent: c.id === campaignId,
            }
          })

          setGenreStats(stats)
        }
      }
    }

    init()
  }, [campaignId])

  // 인증 확인 중 로딩 화면
  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.background,
          color: colors.subText,
          fontSize: '15px',
        }}
      >
        불러오는 중...
      </div>
    )
  }

  // 통계 계산
  const avgRating = average(surveys.map((s) => s.rating))
  const avgRecommend = average(surveys.map((s) => s.recommend_level))

  // 한줄평 목록 (null 제외)
  const oneLiners = surveys
    .filter((s) => s.one_liner && s.one_liner.trim())
    .map((s) => ({ text: s.one_liner!, rating: s.rating }))

  // 좋았던 점 / 아쉬운 점
  const goodPoints = filterText(surveys.map((s) => s.good_points))
  const badPoints = filterText(surveys.map((s) => s.bad_points))

  // 타깃 독자 응답 — 쉼표로 구분된 경우 낱개로 쪼개기
  const targetReaderRaw = filterText(surveys.map((s) => s.target_reader))
  const targetReaders = Array.from(
    new Set(
      targetReaderRaw.flatMap((t) => t.split(',').map((v) => v.trim())).filter(Boolean)
    )
  )

  // 섹션 제목 스타일
  const sectionTitleStyle: React.CSSProperties = {
    margin: '0 0 16px',
    fontSize: '16px',
    fontWeight: 600,
    color: colors.titleText,
  }

  // 뒤로가기 버튼 스타일
  const backBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    fontSize: '15px',
    fontWeight: 600,
    color: backHover ? colors.primary : colors.text,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'color 0.15s ease',
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <div
        style={{
          maxWidth: styles.maxWidth,
          margin: '0 auto',
          padding: '32px 20px 60px',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '32px',
          }}
        >
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.push(`/publisher/dashboard/campaign/${campaignId}`)}
            onMouseEnter={() => setBackHover(true)}
            onMouseLeave={() => setBackHover(false)}
            style={backBtnStyle}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>‹</span>
            캠페인 상세
          </button>
          <Logo size="small" />
        </div>

        {/* 페이지 제목 */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            {/* 캠페인 제목: 진하게 */}
            <span style={{ fontSize: '22px', fontWeight: 700, color: colors.titleText }}>
              {campaignTitle}
            </span>
            {/* "리포트" 라벨: 흐리게 */}
            <span style={{ fontSize: '22px', fontWeight: 400, color: colors.subText }}>
              리포트
            </span>
          </h1>
          <p style={{ margin: '8px 0 0', fontSize: '15px', color: colors.subText }}>
            리뷰어 {completedReviewers}명의 익명 피드백
          </p>
        </div>

        {/* 요약 카드 3개 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
            gap: '12px',
            marginBottom: '28px',
          }}
        >
          {/* 평균 별점 */}
          <div
            style={{
              ...styles.card,
              borderRadius: '14px',
              padding: '28px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: colors.subText, letterSpacing: '0.5px' }}>
              평균 별점
            </p>
            {/* 별과 숫자를 같은 줄에 배치 */}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', color: '#FBBF24', lineHeight: 1 }}>★</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
                {avgRating !== null ? formatScore(avgRating) : '—'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 400, color: colors.subText2 }}>/ 5</span>
            </div>
          </div>

          {/* 추천 의향 */}
          <div
            style={{
              ...styles.card,
              borderRadius: '14px',
              padding: '28px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: colors.subText, letterSpacing: '0.5px' }}>
              추천 의향
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '6px' }}>
              <span style={{ fontSize: '20px', color: '#FBBF24', lineHeight: 1 }}>★</span>
              <span style={{ fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
                {avgRecommend !== null ? formatScore(avgRecommend) : '—'}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 400, color: colors.subText2 }}>/ 5</span>
            </div>
          </div>

          {/* 설문 완료 수 */}
          <div
            style={{
              ...styles.card,
              borderRadius: '14px',
              padding: '28px 20px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 500, color: colors.subText, letterSpacing: '0.5px' }}>
              설문 완료
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: colors.titleText }}>
                {completedReviewers}
              </span>
              <span style={{ fontSize: '14px', fontWeight: 400, color: colors.subText2 }}>
                / {totalReviewers}명
              </span>
            </div>
          </div>
        </div>

        {/* 한줄평 섹션 */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={sectionTitleStyle}>한줄평</h2>
          {oneLiners.length === 0 ? (
            <div
              style={{
                ...styles.card,
                padding: '40px 20px',
                textAlign: 'center',
                color: colors.subText,
                fontSize: '15px',
              }}
            >
              아직 한줄평이 없습니다
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {oneLiners.map((item, idx) => (
                // borderLeft 없는 일반 카드 스타일
                <div key={idx} style={{ ...styles.card, padding: '20px' }}>
                  <p style={{ margin: 0, fontSize: '15px', color: colors.text, lineHeight: 1.6 }}>
                    {item.text}
                  </p>
                  {item.rating !== null && (
                    <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#FBBF24', textAlign: 'right' }}>
                      {'★'.repeat(Math.round(item.rating))}
                      {'☆'.repeat(5 - Math.round(item.rating))}
                      {' '}({item.rating})
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 좋았던 점 / 아쉬운 점 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          {/* 좋았던 점 */}
          <div style={{ ...styles.card, padding: '24px', minHeight: '160px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
              좋았던 점
            </h3>
            {goodPoints.length === 0 ? (
              <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>아직 내용이 없습니다</p>
            ) : (
              goodPoints.map((text, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 0',
                    borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '14px', color: colors.text, lineHeight: 1.6 }}>
                    {text}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* 아쉬운 점 */}
          <div style={{ ...styles.card, padding: '24px', minHeight: '160px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: colors.titleText }}>
              아쉬운 점
            </h3>
            {badPoints.length === 0 ? (
              <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>아직 내용이 없습니다</p>
            ) : (
              badPoints.map((text, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 0',
                    borderTop: idx > 0 ? `1px solid ${colors.border}` : 'none',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '14px', color: colors.text, lineHeight: 1.6 }}>
                    {text}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 하이라이트 섹션 */}
        {(() => {
          // 같은 문장을 표시한 리뷰어 수 집계 (campaign_reviewer_id 기준)
          const textCountMap = new Map<string, Set<string>>()
          for (const hl of highlights) {
            if (!textCountMap.has(hl.text)) {
              textCountMap.set(hl.text, new Set())
            }
            const reviewerId = hl.campaign_reviewer_id ?? `anon-${hl.created_at}`
            textCountMap.get(hl.text)!.add(reviewerId)
          }

          // 중복 제거: 같은 텍스트는 한 번만 보여주되, 카운트 정보 유지
          // 먼저 나온 것(created_at 오름차순) 기준으로 대표 항목 선정
          const seen = new Set<string>()
          const deduped: Array<Highlight & { count: number }> = []
          for (const hl of highlights) {
            if (!seen.has(hl.text)) {
              seen.add(hl.text)
              deduped.push({ ...hl, count: textCountMap.get(hl.text)!.size })
            }
          }

          return (
            <div style={{ marginBottom: '28px' }}>
              <h2 style={sectionTitleStyle}>인상적인 문장 (추천 문구 후보)</h2>
              {deduped.length === 0 ? (
                <div
                  style={{
                    ...styles.card,
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: colors.subText,
                    fontSize: '15px',
                  }}
                >
                  아직 하이라이트가 없습니다
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {deduped.map((hl, idx) => (
                    <div key={idx} style={{ ...styles.card, padding: '20px' }}>
                      <div
                        style={{
                          borderLeft: `3px solid ${hl.count >= 2 ? colors.warning : colors.primary}`,
                          paddingLeft: '16px',
                        }}
                      >
                        {/* 2명 이상이 표시한 문장이면 빈도 뱃지 표시 */}
                        {hl.count >= 2 && (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#FEF3C7',
                              color: colors.warning,
                              fontSize: '12px',
                              fontWeight: 600,
                              padding: '2px 10px',
                              borderRadius: '12px',
                              marginBottom: '8px',
                            }}
                          >
                            {hl.count}명이 표시
                          </span>
                        )}
                        <p
                          style={{
                            margin: 0,
                            fontSize: '15px',
                            color: colors.text,
                            lineHeight: 1.7,
                            fontStyle: 'italic',
                          }}
                        >
                          {hl.text}
                        </p>
                        {hl.chapter_label && (
                          <p style={{ margin: '6px 0 0', fontSize: '13px', color: colors.subText2 }}>
                            {hl.chapter_label}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })()}

        {/* 타깃 독자 섹션 (응답 있을 때만 표시) — 태그 형태로 가로 나열 */}
        {targetReaders.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <h2 style={sectionTitleStyle}>이 책이 어울릴 독자</h2>
            <div style={{ ...styles.card, padding: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {targetReaders.map((text, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: colors.subBackground,
                      border: `1px solid ${colors.border}`,
                      padding: '6px 14px',
                      borderRadius: '16px',
                      fontSize: '14px',
                      color: colors.text,
                    }}
                  >
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 열람 현황 섹션 */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={sectionTitleStyle}>열람 현황</h2>

          {readingSessions.length === 0 ? (
            // 기록 없을 때
            <div style={{ ...styles.card, padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '14px', color: colors.subText2 }}>
                아직 열람 기록이 없습니다
              </p>
            </div>
          ) : (() => {
            // ── 챕터별 합산 체류 시간 계산 ──────────────
            // chapter_index 기준으로 그룹핑
            const chapterMap = new Map<number, { label: string; total: number }>()
            for (const s of readingSessions) {
              const existing = chapterMap.get(s.chapter_index)
              if (existing) {
                existing.total += s.duration_seconds
              } else {
                chapterMap.set(s.chapter_index, {
                  label: s.chapter_label ?? `챕터 ${s.chapter_index + 1}`,
                  total: s.duration_seconds,
                })
              }
            }
            // 챕터 번호 순서대로 정렬
            const chapters = Array.from(chapterMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([index, { label, total }]) => ({ index, label, total }))

            // 막대 그래프 비율 계산용 최대값
            const maxDuration = Math.max(...chapters.map((c) => c.total), 1)

            // ── 리뷰어별 마지막 챕터 집계 (이탈 분석) ──────
            // 각 리뷰어가 읽은 가장 높은 chapter_index
            const lastChapterByReviewer = new Map<string, number>()
            for (const s of readingSessions) {
              const prev = lastChapterByReviewer.get(s.campaign_reviewer_id) ?? -1
              if (s.chapter_index > prev) {
                lastChapterByReviewer.set(s.campaign_reviewer_id, s.chapter_index)
              }
            }
            const totalReadCount = lastChapterByReviewer.size
            const lastChapterIndex = chapters[chapters.length - 1]?.index ?? 0
            // 끝 챕터까지 읽은 사람 = 마지막 챕터가 최대 인덱스인 리뷰어
            const completedReadCount = Array.from(lastChapterByReviewer.values())
              .filter((idx) => idx >= lastChapterIndex).length

            // 가장 많이 이탈한 챕터 = 마지막 챕터 빈도 집계에서 끝 챕터 제외 후 최다
            const dropoffCount = new Map<number, number>()
            for (const idx of Array.from(lastChapterByReviewer.values())) {
              if (idx < lastChapterIndex) {
                dropoffCount.set(idx, (dropoffCount.get(idx) ?? 0) + 1)
              }
            }
            let avgDropoffLabel = ''
            if (dropoffCount.size > 0) {
              const [topDropIdx] = Array.from(dropoffCount.entries())
                .sort(([, a], [, b]) => b - a)[0]
              avgDropoffLabel = chapterMap.get(topDropIdx)?.label ?? `챕터 ${topDropIdx + 1}`
            }

            // 초를 "N초" / "N분 N초" / "N시간 N분" 형태로 변환
            const formatDuration = (sec: number): string => {
              if (sec < 60)   return `${sec}초`
              if (sec < 3600) return `${Math.floor(sec / 60)}분 ${sec % 60}초`
              return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`
            }

            return (
              <div style={{ ...styles.card, padding: '24px' }}>

                {/* 이탈 요약 */}
                <div style={{
                  display: 'flex', gap: '24px', flexWrap: 'wrap',
                  marginBottom: '20px',
                  paddingBottom: '16px',
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>
                    완독 리뷰어:{' '}
                    <span style={{ fontWeight: 600, color: colors.titleText }}>
                      {completedReadCount} / {totalReadCount}명
                    </span>
                  </p>
                  {avgDropoffLabel && (
                    <p style={{ margin: 0, fontSize: '14px', color: colors.subText }}>
                      주요 이탈 구간:{' '}
                      <span style={{ fontWeight: 600, color: colors.titleText }}>
                        {avgDropoffLabel}
                      </span>
                    </p>
                  )}
                </div>

                {/* 챕터별 막대 그래프 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {chapters.map((ch) => (
                    <div key={ch.index} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {/* 챕터 이름 */}
                      <div style={{
                        width: '120px', flexShrink: 0,
                        fontSize: '14px', color: colors.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {ch.label}
                      </div>

                      {/* 막대 배경 */}
                      <div style={{
                        flex: 1, height: '24px',
                        background: colors.subBackground, borderRadius: '4px',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        {/* 채워진 막대 */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${(ch.total / maxDuration) * 100}%`,
                          background: colors.primary, borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>

                      {/* 시간 텍스트 */}
                      <div style={{
                        width: '60px', flexShrink: 0, textAlign: 'right',
                        fontSize: '13px', color: colors.subText,
                      }}>
                        {formatDuration(ch.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>

        {/* 사전 수요 섹션 */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={sectionTitleStyle}>사전 수요</h2>
          <div style={{ ...styles.card, padding: '24px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '14px', color: colors.subText }}>
              "읽고 싶다" 등록 수
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '28px', fontWeight: 700, color: colors.titleText }}>
                {wtrCount}
              </span>
              <span style={{ fontSize: '16px', fontWeight: 400, color: colors.subText, marginLeft: '2px' }}>명</span>
            </div>
          </div>
        </div>

        {/* 장르 비교 섹션 — 같은 장르 캠페인이 2개 이상일 때만 표시 */}
        {genreStats.length >= 2 && (() => {
          // 비교 항목별 최대값 계산 (막대 너비 기준)
          const maxRating    = Math.max(...genreStats.map((g) => g.avgRating    ?? 0), 0.1)
          const maxRecommend = Math.max(...genreStats.map((g) => g.avgRecommend ?? 0), 0.1)
          const maxWtr       = Math.max(...genreStats.map((g) => g.wtrCount),           1)

          // 비교 막대 하나를 그리는 내부 함수
          const Bar = ({
            value,
            max,
            highlight,
            label,
          }: {
            value: number | null
            max: number
            highlight: boolean
            label: string
          }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ width: '100px', fontSize: '13px', color: colors.subText, flexShrink: 0 }}>
                {label}
              </div>
              <div style={{
                flex: 1, height: '20px',
                background: colors.subBackground, borderRadius: '4px',
                position: 'relative', overflow: 'hidden',
              }}>
                {value !== null && (
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${(value / max) * 100}%`,
                    background: highlight ? colors.primary : colors.border,
                    borderRadius: '4px',
                    transition: 'width 0.4s ease',
                  }} />
                )}
              </div>
              <div style={{
                width: '40px', flexShrink: 0, textAlign: 'right',
                fontSize: '13px',
                fontWeight: highlight ? 600 : 400,
                color: highlight ? colors.titleText : colors.subText,
              }}>
                {value !== null ? value.toFixed(1) : '—'}
              </div>
            </div>
          )

          return (
            <div style={{ marginBottom: '28px' }}>
              <h2 style={sectionTitleStyle}>장르 비교</h2>
              <div style={{ ...styles.card, padding: '24px' }}>
                {/* 비교 지표 범례 */}
                <div style={{
                  display: 'flex', gap: '16px', marginBottom: '20px',
                  paddingBottom: '16px', borderBottom: `1px solid ${colors.border}`,
                  fontSize: '12px', color: colors.subText2,
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      display: 'inline-block', width: '12px', height: '12px',
                      background: colors.primary, borderRadius: '2px',
                    }} />
                    현재 캠페인
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{
                      display: 'inline-block', width: '12px', height: '12px',
                      background: colors.border, borderRadius: '2px',
                    }} />
                    같은 장르 다른 캠페인
                  </span>
                </div>

                {/* 캠페인별 비교 */}
                {genreStats.map((g, idx) => (
                  <div key={idx} style={{ marginBottom: idx < genreStats.length - 1 ? '20px' : 0 }}>
                    {/* 캠페인 제목 */}
                    <p style={{
                      margin: '0 0 10px',
                      fontSize: '14px',
                      fontWeight: g.isCurrent ? 600 : 400,
                      color: g.isCurrent ? colors.titleText : colors.subText,
                    }}>
                      {g.title}
                      {g.isCurrent && (
                        <span style={{
                          marginLeft: '8px',
                          background: colors.primary,
                          color: '#FFFFFF',
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '10px',
                        }}>
                          현재
                        </span>
                      )}
                    </p>

                    {/* 평균 별점 */}
                    <Bar
                      value={g.avgRating}
                      max={maxRating}
                      highlight={g.isCurrent}
                      label="평균 별점"
                    />

                    {/* 추천 의향 */}
                    <Bar
                      value={g.avgRecommend}
                      max={maxRecommend}
                      highlight={g.isCurrent}
                      label="추천 의향"
                    />

                    {/* 읽고 싶다 수 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '100px', fontSize: '13px', color: colors.subText, flexShrink: 0 }}>
                        읽고 싶다
                      </div>
                      <div style={{
                        flex: 1, height: '20px',
                        background: colors.subBackground, borderRadius: '4px',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0,
                          width: `${(g.wtrCount / maxWtr) * 100}%`,
                          background: g.isCurrent ? colors.primary : colors.border,
                          borderRadius: '4px',
                          transition: 'width 0.4s ease',
                        }} />
                      </div>
                      <div style={{
                        width: '40px', flexShrink: 0, textAlign: 'right',
                        fontSize: '13px',
                        fontWeight: g.isCurrent ? 600 : 400,
                        color: g.isCurrent ? colors.titleText : colors.subText,
                      }}>
                        {g.wtrCount}명
                      </div>
                    </div>

                    {/* 구분선 (마지막 항목 제외) */}
                    {idx < genreStats.length - 1 && (
                      <div style={{
                        height: '1px', background: colors.border,
                        margin: '16px 0 0',
                      }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
