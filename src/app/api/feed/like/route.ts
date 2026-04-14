// 좋아요 토글 API
// 사용자 인증 토큰 + anon key 사용 (RLS 적용)
// 좋아요 추가 시 리뷰 작성자에게 알림 전송
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notify'

// service_role 클라이언트 (알림 및 리뷰어 정보 조회용)
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

  const { reviewId } = await request.json()
  if (!reviewId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  // 기존 좋아요 여부 확인
  const { data: existing } = await supabase
    .from('review_likes')
    .select('id')
    .eq('public_review_id', reviewId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // 이미 좋아요 → 취소 (알림 없음)
    await supabase
      .from('review_likes')
      .delete()
      .eq('public_review_id', reviewId)
      .eq('user_id', user.id)
    return NextResponse.json({ liked: false })
  }

  // 좋아요 추가
  await supabase
    .from('review_likes')
    .insert({ public_review_id: reviewId, user_id: user.id })

  // 리뷰 작성자 확인 + 알림 전송
  const admin = getServiceClient()
  const { data: review } = await admin
    .from('public_reviews')
    .select('reviewer_id')
    .eq('id', reviewId)
    .single()

  if (review && review.reviewer_id !== user.id) {
    // 본인 리뷰에 본인이 좋아요하면 알림 안 보냄
    const { data: liker } = await admin
      .from('profiles')
      .select('name, email')
      .eq('id', user.id)
      .single()
    const likerName = liker?.name || liker?.email || '누군가'

    await createNotification({
      userId: review.reviewer_id,
      type: 'review_liked',
      referenceId: reviewId,
      referenceType: 'public_review',
      message: `${likerName}님이 회원님의 리뷰를 좋아합니다`,
    })
  }

  return NextResponse.json({ liked: true })
}
