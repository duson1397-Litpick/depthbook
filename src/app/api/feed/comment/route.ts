// 피드 댓글 API
// GET  ?reviewId=xxx  — 댓글 목록 조회 (누구나 가능)
// POST { reviewId, content } — 댓글 작성 (로그인 필요)
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createNotification } from '@/lib/notify'

// 서비스 클라이언트 (RLS 우회, 조회 및 알림용)
function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── GET: 댓글 목록 조회 ─────────────────────────────
export async function GET(request: NextRequest) {
  const reviewId = request.nextUrl.searchParams.get('reviewId')
  if (!reviewId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const supabase = getServiceClient()

  // 댓글 목록 조회 (오래된 순)
  const { data: comments, error } = await supabase
    .from('review_comments')
    .select('id, content, created_at, user_id')
    .eq('public_review_id', reviewId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!comments || comments.length === 0) {
    return NextResponse.json({ comments: [] })
  }

  // 댓글 작성자 이름 일괄 조회
  const userIds = Array.from(new Set(comments.map((c) => c.user_id as string)))

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds)

  // user_id → 이름 맵
  const nameMap: Record<string, string> = {}
  ;(profiles ?? []).forEach((p: any) => {
    nameMap[p.id] = p.name || p.email || '익명'
  })

  // 댓글에 이름 합치기
  const result = comments.map((c) => ({
    id: c.id,
    content: c.content,
    created_at: c.created_at,
    user_id: c.user_id,
    user_name: nameMap[c.user_id] ?? '익명',
  }))

  return NextResponse.json({ comments: result })
}

// ── POST: 댓글 작성 ─────────────────────────────────
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  // 유저 토큰으로 본인 확인
  const userSupabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const { reviewId, content } = await request.json()
  if (!reviewId || !content?.trim()) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  const admin = getServiceClient()

  // 댓글 INSERT
  const { data: newComment, error } = await admin
    .from('review_comments')
    .insert({
      public_review_id: reviewId,
      user_id: user.id,
      content: content.trim(),
    })
    .select('id, content, created_at, user_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 댓글 작성자 이름 조회
  const { data: commenterProfile } = await admin
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single()

  const commenterName = commenterProfile?.name || commenterProfile?.email || '누군가'

  // 리뷰 작성자 확인 → 본인 댓글이면 알림 안 보냄
  const { data: review } = await admin
    .from('public_reviews')
    .select('reviewer_id')
    .eq('id', reviewId)
    .single()

  if (review && review.reviewer_id !== user.id) {
    await createNotification({
      userId: review.reviewer_id,
      type: 'review_commented',
      referenceId: reviewId,
      referenceType: 'public_review',
      message: `${commenterName}님이 회원님의 리뷰에 댓글을 남겼습니다`,
    })
  }

  return NextResponse.json({
    comment: {
      id: newComment.id,
      content: newComment.content,
      created_at: newComment.created_at,
      user_id: newComment.user_id,
      user_name: commenterName,
    },
  })
}
