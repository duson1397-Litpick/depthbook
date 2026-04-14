// 알림 조회 / 읽음 처리 API
// GET: 내 알림 목록 (최신 20개)
// PATCH: 알림 읽음 처리
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// 사용자 인증 클라이언트 (RLS 적용)
function getUserClient(authHeader: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  )
}

// GET: 내 알림 목록 + 읽지 않은 수
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const supabase = getUserClient(authHeader)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, reference_id, reference_type, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const unreadCount = (notifications ?? []).filter((n: any) => !n.is_read).length

  return NextResponse.json({
    notifications: notifications ?? [],
    unreadCount,
  })
}

// PATCH: 알림 읽음 처리
// body: { notificationId } 또는 { markAllRead: true }
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const supabase = getUserClient(authHeader)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인 필요' }, { status: 401 })
  }

  const body = await request.json()

  if (body.markAllRead) {
    // 전체 읽음 처리
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
  } else if (body.notificationId) {
    // 개별 읽음 처리
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', body.notificationId)
      .eq('user_id', user.id)
  }

  return NextResponse.json({ success: true })
}
