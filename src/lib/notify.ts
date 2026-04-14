// 알림 생성 유틸
// service_role로 직접 INSERT (notifications 테이블은 INSERT 정책 없음)
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function createNotification({
  userId,
  type,
  referenceId,
  referenceType,
  message,
}: {
  userId: string
  type: string
  referenceId?: string
  referenceType?: string
  message: string
}) {
  await adminSupabase.from('notifications').insert({
    user_id: userId,
    type,
    reference_id: referenceId ?? null,
    reference_type: referenceType ?? null,
    message,
  })
}
