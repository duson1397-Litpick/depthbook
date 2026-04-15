import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { FREE_CAMPAIGN_LIMIT } from '@/lib/plans'

// GET /api/free-campaigns
// 현재 출판사의 무료 캠페인 사용 현황을 반환합니다.
// 같은 사업자번호를 가진 모든 계정의 무료 캠페인을 합산합니다.
// Authorization: Bearer <access_token>
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  // 익명 키로 supabase 클라이언트 생성 후 토큰으로 사용자 확인
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })
  }

  // 해당 출판사의 사업자번호 조회
  const { data: publisher } = await supabase
    .from('publishers')
    .select('business_number')
    .eq('id', user.id)
    .single()

  let publisherIds: string[] = [user.id]

  if (publisher?.business_number) {
    // 같은 사업자번호를 가진 모든 출판사 ID 조회
    const { data: sameBusinessPublishers } = await supabase
      .from('publishers')
      .select('id')
      .eq('business_number', publisher.business_number)

    if (sameBusinessPublishers && sameBusinessPublishers.length > 0) {
      publisherIds = sameBusinessPublishers.map((p) => p.id)
    }
  }

  // 해당 출판사들의 무료 캠페인 수 합산
  const { count } = await supabase
    .from('campaigns')
    .select('*', { count: 'exact', head: true })
    .in('publisher_id', publisherIds)
    .eq('is_free', true)

  const used = count ?? 0

  return NextResponse.json({
    used,
    limit: FREE_CAMPAIGN_LIMIT,
    remaining: Math.max(0, FREE_CAMPAIGN_LIMIT - used),
  })
}
