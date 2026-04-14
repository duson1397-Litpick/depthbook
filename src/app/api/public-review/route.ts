// 공개 리뷰 API
// service_role 키로 RLS 우회
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET ?accessToken=xxx → 공개 리뷰 작성 여부 확인
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get('accessToken')

  if (!accessToken) {
    return NextResponse.json({ error: '토큰이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // access_token으로 campaign_reviewer 조회
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('id, campaign_id, reviewer_id')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 404 })
  }

  // 이미 작성된 공개 리뷰가 있는지 확인
  const { data: existing } = await supabase
    .from('public_reviews')
    .select('id')
    .eq('campaign_id', reviewer.campaign_id)
    .eq('reviewer_id', reviewer.reviewer_id)
    .single()

  return NextResponse.json({ submitted: !!existing })
}

// POST: 공개 리뷰 저장
// body: { accessToken, title, content, rating }
export async function POST(request: NextRequest) {
  const { accessToken, title, content, rating } = await request.json()

  if (!accessToken || !content || !rating) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // access_token으로 campaign_reviewer 조회
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('id, campaign_id, reviewer_id')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 404 })
  }

  // 중복 방지
  const { data: existing } = await supabase
    .from('public_reviews')
    .select('id')
    .eq('campaign_id', reviewer.campaign_id)
    .eq('reviewer_id', reviewer.reviewer_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: '이미 작성된 리뷰입니다' }, { status: 409 })
  }

  // public_reviews 테이블에 저장
  const { error: insertError } = await supabase
    .from('public_reviews')
    .insert({
      campaign_id: reviewer.campaign_id,
      reviewer_id: reviewer.reviewer_id,
      title: title || null,
      content,
      rating,
    })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
