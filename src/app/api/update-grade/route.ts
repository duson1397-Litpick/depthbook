// 리뷰어 등급 재계산 API
// POST { reviewerId } — HTTP로 직접 호출할 때 사용
// 실제 로직은 src/lib/grade.ts의 recalculateGrade에 있음
import { NextRequest, NextResponse } from 'next/server'
import { recalculateGrade } from '@/lib/grade'

export async function POST(request: NextRequest) {
  const { reviewerId } = await request.json()

  if (!reviewerId) {
    return NextResponse.json({ error: '필수 값이 없습니다' }, { status: 400 })
  }

  try {
    await recalculateGrade(reviewerId)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '등급 계산 실패' }, { status: 500 })
  }
}
