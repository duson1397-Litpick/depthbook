// 열람 기록 API
// POST: 챕터별 체류 시간 기록 (누적)
// GET:  캠페인 전체 열람 기록 조회 (리포트용)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── POST: 체류 시간 기록 ────────────────────────────
// body: { campaignReviewerId, campaignId, chapterIndex, chapterLabel, durationSeconds }
// 같은 (campaign_reviewer_id, chapter_index)가 이미 있으면 누적, 없으면 INSERT
export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '잘못된 요청 형식' }, { status: 400 })
  }

  const { campaignReviewerId, campaignId, chapterIndex, chapterLabel, durationSeconds } = body

  // 필수 값 검사
  if (!campaignReviewerId || !campaignId || chapterIndex == null || !durationSeconds) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  // 최소 체류 시간 3초 미만은 무시 (실수로 스치는 경우 제외)
  if (durationSeconds < 3) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const supabase = getServiceClient()

  // 같은 챕터에 대한 기존 기록 확인
  const { data: existing } = await supabase
    .from('reading_sessions')
    .select('id, duration_seconds')
    .eq('campaign_reviewer_id', campaignReviewerId)
    .eq('chapter_index', chapterIndex)
    .maybeSingle()

  if (existing) {
    // 이미 기록 있음 → 체류 시간 누적
    await supabase
      .from('reading_sessions')
      .update({ duration_seconds: existing.duration_seconds + durationSeconds })
      .eq('id', existing.id)
  } else {
    // 첫 번째 기록 → INSERT
    await supabase
      .from('reading_sessions')
      .insert({
        campaign_reviewer_id: campaignReviewerId,
        campaign_id: campaignId,
        chapter_index: chapterIndex,
        chapter_label: chapterLabel ?? null,
        duration_seconds: durationSeconds,
      })
  }

  return NextResponse.json({ ok: true })
}

// ── GET: 캠페인 전체 열람 기록 조회 ─────────────────
// query: ?campaignId=xxx
// 리포트 페이지에서 챕터별 합산 데이터를 그래프로 표시
export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaignId')
  if (!campaignId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  const { data: sessions, error } = await supabase
    .from('reading_sessions')
    .select('chapter_index, chapter_label, duration_seconds, campaign_reviewer_id')
    .eq('campaign_id', campaignId)
    .order('chapter_index', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ sessions: sessions ?? [] })
}
