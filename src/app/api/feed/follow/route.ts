// 팔로우 토글 API
// 사용자 인증 토큰 + anon key 사용 (RLS 적용)
// 팔로우 시 대상에게 알림 전송
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notify'

// service_role 클라이언트 (알림 및 이름 조회용)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

  const { reviewerId } = await request.json()
  if (!reviewerId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  // 자기 자신 팔로우 방지
  if (reviewerId === user.id) {
    return NextResponse.json({ error: '자신을 팔로우할 수 없습니다' }, { status: 400 })
  }

  // 기존 팔로우 여부 확인
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('following_id', reviewerId)
    .eq('follower_id', user.id)
    .single()

  if (existing) {
    // 이미 팔로우 → 언팔로우 (알림 없음)
    await supabase
      .from('follows')
      .delete()
      .eq('following_id', reviewerId)
      .eq('follower_id', user.id)
    return NextResponse.json({ following: false })
  }

  // 팔로우 추가
  await supabase
    .from('follows')
    .insert({ following_id: reviewerId, follower_id: user.id })

  // 팔로우 대상에게 알림 전송
  const admin = getServiceClient()
  const { data: follower } = await admin
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single()
  const followerName = follower?.name || follower?.email || '누군가'

  await createNotification({
    userId: reviewerId,
    type: 'new_follower',
    referenceId: user.id,
    referenceType: 'profile',
    message: `${followerName}님이 회원님을 팔로우합니다`,
  })

  return NextResponse.json({ following: true })
}
