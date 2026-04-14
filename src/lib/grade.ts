// 리뷰어 등급 계산 유틸
// 등급 기준:
//   bronze   — 기본 (가입 시)
//   silver   — 리뷰 3개 이상 + 완료율 70% 이상
//   gold     — 리뷰 7개 이상 + 완료율 85% 이상 + 평균 퀄리티 점수 3.5 이상 (없으면 무시)
//   platinum — 리뷰 15개 이상 + 완료율 90% 이상 + 평균 퀄리티 점수 4.0 이상 (없으면 무시)
import { createClient } from '@supabase/supabase-js'
import { createNotification } from '@/lib/notify'

export type Grade = 'bronze' | 'silver' | 'gold' | 'platinum'

// 등급 표시 레이블 (UI에서 사용)
export const GRADE_LABELS: Record<Grade, string> = {
  bronze:   '🥉 브론즈',
  silver:   '🥈 실버',
  gold:     '🥇 골드',
  platinum: '💎 플래티넘',
}

// 등급 순서 (올라갔는지 비교용)
const GRADE_ORDER: Record<string, number> = {
  bronze: 0, silver: 1, gold: 2, platinum: 3,
}

// 알림에 쓸 한글 등급 이름
const GRADE_DISPLAY: Record<string, string> = {
  silver:   '실버',
  gold:     '골드',
  platinum: '플래티넘',
}

// ── 순수 등급 계산 함수 ──────────────────────────────
// 입력 수치만으로 등급을 계산 (DB 접근 없음)
export function calculateGrade({
  totalReviews,
  completedCampaigns,
  totalAcceptedCampaigns,
  avgQualityScore,
}: {
  totalReviews: number
  completedCampaigns: number
  totalAcceptedCampaigns: number
  avgQualityScore: number | null
}): Grade {
  // 완료율 = 완료 수 / 전체 참여(수락+읽는중+완료) 수
  const completionRate = totalAcceptedCampaigns > 0
    ? completedCampaigns / totalAcceptedCampaigns
    : 0

  // 퀄리티 점수가 없으면(null) 해당 조건은 통과로 간주
  const qualityOkForPlatinum = avgQualityScore === null || avgQualityScore >= 4.0
  const qualityOkForGold     = avgQualityScore === null || avgQualityScore >= 3.5

  if (totalReviews >= 15 && completionRate >= 0.9 && qualityOkForPlatinum) {
    return 'platinum'
  }
  if (totalReviews >= 7 && completionRate >= 0.85 && qualityOkForGold) {
    return 'gold'
  }
  if (totalReviews >= 3 && completionRate >= 0.7) {
    return 'silver'
  }
  return 'bronze'
}

// ── DB 데이터 조회 후 등급 재계산 + 저장 ──────────────
// 설문 제출 완료 시점에 호출
export async function recalculateGrade(reviewerId: string): Promise<void> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 1. 전체 참여 캠페인 수 (수락됨 + 읽는중 + 완료)
  const { count: totalAccepted } = await supabase
    .from('campaign_reviewers')
    .select('*', { count: 'exact', head: true })
    .eq('reviewer_id', reviewerId)
    .in('status', ['accepted', 'reading', 'completed'])

  // 2. 완료 캠페인 수
  const { count: completed } = await supabase
    .from('campaign_reviewers')
    .select('*', { count: 'exact', head: true })
    .eq('reviewer_id', reviewerId)
    .eq('status', 'completed')

  // 3. 제출한 설문 수 (= 리뷰 수)
  //    surveys 테이블에 reviewer_id가 없으므로
  //    completed 상태인 campaign_reviewer id 목록으로 집계
  const { data: completedRows } = await supabase
    .from('campaign_reviewers')
    .select('id')
    .eq('reviewer_id', reviewerId)
    .eq('status', 'completed')

  const completedIds = (completedRows ?? []).map((r: any) => r.id as string)

  let totalReviews = 0
  if (completedIds.length > 0) {
    const { count: surveyCount } = await supabase
      .from('surveys')
      .select('*', { count: 'exact', head: true })
      .in('campaign_reviewer_id', completedIds)
    totalReviews = surveyCount ?? 0
  }

  // 4. 평균 퀄리티 점수 조회 (출판사가 매기는 점수, 없으면 null)
  const { data: ratings } = await supabase
    .from('review_ratings')
    .select('quality_score')
    .eq('reviewer_id', reviewerId)

  let avgQualityScore: number | null = null
  if (ratings && ratings.length > 0) {
    const scores = (ratings as any[])
      .map((r) => r.quality_score)
      .filter((s): s is number => typeof s === 'number')
    if (scores.length > 0) {
      avgQualityScore = scores.reduce((a, b) => a + b, 0) / scores.length
    }
  }

  // 5. 등급 계산
  const newGrade = calculateGrade({
    totalReviews,
    completedCampaigns: completed ?? 0,
    totalAcceptedCampaigns: totalAccepted ?? 0,
    avgQualityScore,
  })

  // 6. 현재 등급 조회 (등급이 올랐는지 비교하기 위해)
  const { data: currentProfile } = await supabase
    .from('reviewer_profiles')
    .select('grade')
    .eq('id', reviewerId)
    .single()

  const prevGrade = (currentProfile?.grade as string | null) ?? 'bronze'

  // 7. reviewer_profiles 업데이트 (없으면 생성)
  await supabase
    .from('reviewer_profiles')
    .upsert({
      id: reviewerId,
      grade: newGrade,
      total_reviews: totalReviews,
      completed_campaigns: completed ?? 0,
      avg_rating_received: avgQualityScore,
    }, { onConflict: 'id' })

  // 8. 등급이 올라갔으면 알림 전송
  const prevOrder = GRADE_ORDER[prevGrade] ?? 0
  const newOrder  = GRADE_ORDER[newGrade]  ?? 0

  if (newOrder > prevOrder && GRADE_DISPLAY[newGrade]) {
    await createNotification({
      userId: reviewerId,
      type: 'grade_upgraded',
      referenceType: 'reviewer_profile',
      message: `🎉 등급이 ${GRADE_DISPLAY[newGrade]}으로 올랐습니다!`,
    })
  }
}
