// 설문 제출 / 조회 API
// service_role 키로 RLS 우회
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { recalculateGrade } from '@/lib/grade'
import { sendEmail } from '@/lib/email'
import { surveyThankYouEmail } from '@/lib/email-templates'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET ?accessToken=xxx → 설문 제출 여부 확인
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get('accessToken')

  if (!accessToken) {
    return NextResponse.json({ error: '토큰이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // access_token으로 campaign_reviewer 조회
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('id, campaign_id')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 404 })
  }

  // 이미 제출한 설문이 있는지 확인
  const { data: existing } = await supabase
    .from('surveys')
    .select('id')
    .eq('campaign_id', reviewer.campaign_id)
    .eq('campaign_reviewer_id', reviewer.id)
    .single()

  return NextResponse.json({ submitted: !!existing })
}

// POST: 설문 제출
export async function POST(request: NextRequest) {
  const {
    accessToken,
    rating,
    oneLiner,
    goodPoints,
    badPoints,
    recommendLevel,
    targetReader,
  } = await request.json()

  if (!accessToken || !rating || !oneLiner) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // access_token으로 campaign_reviewer 조회 (reviewer_id 포함)
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('id, campaign_id, reviewer_id')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 404 })
  }

  // 중복 제출 방지
  const { data: existing } = await supabase
    .from('surveys')
    .select('id')
    .eq('campaign_id', reviewer.campaign_id)
    .eq('campaign_reviewer_id', reviewer.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: '이미 제출된 설문입니다' }, { status: 409 })
  }

  // surveys 테이블에 저장 (surveys 테이블에는 reviewer_id 컬럼 없음)
  const { error: insertError } = await supabase
    .from('surveys')
    .insert({
      campaign_id: reviewer.campaign_id,
      campaign_reviewer_id: reviewer.id,
      rating,
      one_liner: oneLiner,
      good_points: goodPoints || null,
      bad_points: badPoints || null,
      recommend_level: recommendLevel ?? null,
      target_reader: targetReader || null,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // campaign_reviewers 상태를 'completed'로 변경
  await supabase
    .from('campaign_reviewers')
    .update({ status: 'completed' })
    .eq('id', reviewer.id)

  // 설문 제출 완료 후 등급 재계산 (실패해도 설문 제출 자체는 성공으로 처리)
  if (reviewer.reviewer_id) {
    recalculateGrade(reviewer.reviewer_id).catch((err) => {
      console.error('등급 재계산 실패:', err)
    })
  }

  // 리뷰어에게 감사 이메일 발송 (fire-and-forget)
  // 캠페인 제목과 리뷰어 이메일을 조회해서 발송
  supabase
    .from('campaigns')
    .select('title')
    .eq('id', reviewer.campaign_id)
    .single()
    .then(({ data: campaignData }) => {
      if (!campaignData?.title) return

      supabase
        .from('profiles')
        .select('email')
        .eq('id', reviewer.reviewer_id)
        .single()
        .then(({ data: profileData }) => {
          if (!profileData?.email) return

          const { subject, html } = surveyThankYouEmail(campaignData.title)
          sendEmail({ to: profileData.email, subject, html })
        })
    })

  return NextResponse.json({ success: true })
}
