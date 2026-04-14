// 토큰 검증 API
// service_role 키로 RLS 없이 직접 조회하므로 클라이언트에서 호출 가능
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { token, email } = body

  if (!token) {
    return NextResponse.json({ error: '토큰이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 토큰으로 리뷰어 + 캠페인 조회
  const { data: reviewer, error: reviewerError } = await supabase
    .from('campaign_reviewers')
    .select(`
      id,
      reviewer_id,
      status,
      token_verified_at,
      campaigns (
        id,
        title,
        status,
        epub_storage_path
      )
    `)
    .eq('access_token', token)
    .single()

  // 디버그 로그: 조회 결과 확인
  console.log('[verify-token] 받은 token:', token)
  console.log('[verify-token] 조회 결과:', JSON.stringify(reviewer, null, 2))
  console.log('[verify-token] 조회 에러:', reviewerError)

  if (!reviewer) {
    return NextResponse.json({
      error: '토큰 조회 실패',
      token: token,
      dbError: reviewerError ? { message: reviewerError.message, code: reviewerError.code, details: reviewerError.details } : null,
    }, { status: 404 })
  }

  const campaign = (reviewer as any).campaigns

  if (!campaign) {
    return NextResponse.json({ error: '캠페인 정보를 찾을 수 없습니다' }, { status: 404 })
  }

  // 종료된 캠페인인지 확인
  if (campaign.status === 'completed') {
    return NextResponse.json({ error: '종료된 캠페인입니다' }, { status: 403 })
  }

  // 이메일 인증 요청인 경우 (email 값이 있을 때)
  if (email) {
    // 리뷰어의 프로필에서 이메일 조회
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', reviewer.reviewer_id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: '리뷰어 정보를 찾을 수 없습니다' }, { status: 404 })
    }

    // 이메일 일치 여부 확인 (대소문자 구분 없이)
    if (profile.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: '이메일이 일치하지 않습니다' }, { status: 401 })
    }

    // 이메일 일치 → token_verified_at 업데이트
    await supabase
      .from('campaign_reviewers')
      .update({ token_verified_at: new Date().toISOString() })
      .eq('id', reviewer.id)

    // 인증 성공 시 이메일을 함께 반환 (워터마크용)
    return NextResponse.json({ verified: true, reviewerEmail: email })
  }

  // 이메일 인증 없이 토큰 정보만 조회하는 경우
  // 이미 인증된 상태라면 리뷰어 이메일도 함께 반환 (워터마크용)
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', reviewer.reviewer_id)
    .single()

  return NextResponse.json({
    campaignTitle: campaign.title,
    campaignStatus: campaign.status,
    isVerified: !!reviewer.token_verified_at,
    reviewerEmail: profile?.email ?? '',
    // 열람 기록 수집에 필요한 식별자
    campaignReviewerId: reviewer.id,
    campaignId: campaign.id,
  })
}
