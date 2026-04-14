// 하이라이트 저장 / 조회 API
// service_role 키로 RLS 우회
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET ?accessToken=xxx → 해당 리뷰어의 하이라이트 목록 반환
export async function GET(request: NextRequest) {
  const accessToken = request.nextUrl.searchParams.get('accessToken')

  if (!accessToken) {
    return NextResponse.json({ error: '토큰이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // access_token으로 campaign_reviewer 조회
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('id, reviewer_id, campaign_id')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰' }, { status: 404 })
  }

  // 해당 리뷰어의 하이라이트 목록 조회
  const { data: highlights } = await supabase
    .from('highlights')
    .select('id, text, cfi_range, chapter_label, created_at')
    .eq('campaign_id', reviewer.campaign_id)
    .eq('reviewer_id', reviewer.reviewer_id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ highlights: highlights ?? [] })
}

// POST { accessToken, text, cfiRange, chapterLabel } → 하이라이트 저장
export async function POST(request: NextRequest) {
  const { accessToken, text, cfiRange, chapterLabel } = await request.json()

  if (!accessToken || !text || !cfiRange) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // access_token으로 campaign_reviewer 조회
  const { data: reviewer } = await supabase
    .from('campaign_reviewers')
    .select('id, reviewer_id, campaign_id')
    .eq('access_token', accessToken)
    .single()

  if (!reviewer) {
    return NextResponse.json({ error: '유효하지 않은 토큰', receivedToken: accessToken }, { status: 404 })
  }

  // 같은 cfi_range가 이미 있으면 중복 저장 방지
  const { data: existing } = await supabase
    .from('highlights')
    .select('id')
    .eq('campaign_id', reviewer.campaign_id)
    .eq('reviewer_id', reviewer.reviewer_id)
    .eq('cfi_range', cfiRange)
    .single()

  if (existing) {
    return NextResponse.json({ message: '이미 저장된 하이라이트' })
  }

  // highlights 테이블에 저장
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      campaign_id: reviewer.campaign_id,
      reviewer_id: reviewer.reviewer_id,
      text,
      cfi_range: cfiRange,
      chapter_label: chapterLabel ?? null,
    })
    .select('id, text, cfi_range, chapter_label')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code, details: error.details }, { status: 500 })
  }

  return NextResponse.json({ highlight: data })
}
