// 읽고 싶다 토글 API
// 사용자 인증 토큰 + anon key 사용 (RLS 적용)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const { campaignId } = await request.json()
  if (!campaignId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  // 기존 읽고싶다 여부 확인
  const { data: existing, error: checkError } = await supabase
    .from('want_to_read')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('user_id', user.id)
    .single()

  if (checkError && checkError.code !== 'PGRST116') {
    // PGRST116 = 행 없음(정상). 그 외 에러는 실제 오류
    return NextResponse.json({ error: checkError.message, code: checkError.code }, { status: 500 })
  }

  if (existing) {
    // 이미 등록 → 취소
    const { error: deleteError } = await supabase
      .from('want_to_read')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message, code: deleteError.code }, { status: 500 })
    }
    return NextResponse.json({ added: false })
  }

  // 읽고싶다 추가
  const { error: insertError } = await supabase
    .from('want_to_read')
    .insert({ campaign_id: campaignId, user_id: user.id })

  if (insertError) {
    return NextResponse.json({ error: insertError.message, code: insertError.code }, { status: 500 })
  }

  return NextResponse.json({ added: true })
}
