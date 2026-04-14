// epub 서명된 URL 발급 API
// service_role 키로 Storage에 접근해 1시간 유효한 서명 URL을 반환
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { accessToken } = await request.json()

  if (!accessToken) {
    return NextResponse.json({ error: '토큰이 없습니다' }, { status: 400 })
  }

  // service_role 키로 Supabase 클라이언트 생성 (RLS 우회)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 토큰으로 리뷰어 + 캠페인 조회
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('campaign_id, status, token_verified_at, campaigns(epub_storage_path, status)')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 404 })
  }

  // 이메일 인증 여부 확인
  if (!reviewer.token_verified_at) {
    return NextResponse.json({ error: '이메일 인증이 필요합니다' }, { status: 403 })
  }

  const campaign = (reviewer as any).campaigns

  if (campaign.status === 'completed') {
    return NextResponse.json({ error: '종료된 캠페인' }, { status: 403 })
  }

  if (!campaign.epub_storage_path) {
    return NextResponse.json({ error: '원고 파일 없음' }, { status: 404 })
  }

  // 서명된 URL 발급 (1시간 유효)
  const { data: signedUrl } = await supabase.storage
    .from('manuscripts')
    .createSignedUrl(campaign.epub_storage_path, 3600)

  if (!signedUrl) {
    return NextResponse.json({ error: 'URL 생성 실패' }, { status: 500 })
  }

  return NextResponse.json({ url: signedUrl.signedUrl })
}
