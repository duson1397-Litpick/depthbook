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

      // 하이라이트 조회
      const { data: highlightData } = await supabase
        .from('highlights')
        .select('text, chapter_label, created_at')
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
        <div style={{ marginBottom: '28px' }}>
          <h2 style={sectionTitleStyle}>인상적인 문장 (추천 문구 후보)</h2>
          {highlights.length === 0 ? (
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
              {highlights.map((hl, idx) => (
                <div key={idx} style={{ ...styles.card, padding: '20px' }}>
                  <div
                    style={{
                      borderLeft: `3px solid ${colors.primary}`,
                      paddingLeft: '16px',
                    }}
                  >
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
      </div>
    </div>
  )
}
