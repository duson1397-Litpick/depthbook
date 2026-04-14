// 리뷰 신고 API
// POST { reviewId, reason, detail } — 로그인 필요 (Authorization 헤더)
// 같은 유저가 같은 리뷰를 중복 신고하면 409 반환
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  // Authorization 헤더에서 Bearer 토큰 추출
  const authHeader = request.headers.get('Authorization') ?? ''
  const accessToken = authHeader.replace('Bearer ', '').trim()

  if (!accessToken) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 })
  }

  // 토큰으로 현재 유저 확인
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  )
  const { data: { user } } = await userClient.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 401 })
  }

  const { reviewId, reason, detail } = await request.json()

  if (!reviewId || !reason) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 중복 신고 확인
  const { data: existing } = await supabase
    .from('reports')
    .select('id')
    .eq('reporter_id', user.id)
    .eq('public_review_id', reviewId)
    .single()

  if (existing) {
    return NextResponse.json({ error: '이미 신고한 리뷰입니다' }, { status: 409 })
  }

  // 신고 저장
  const { error } = await supabase
    .from('reports')
    .insert({
      reporter_id:      user.id,
      public_review_id: reviewId,
      reason,
      detail: detail ?? '',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reported: true })
}
