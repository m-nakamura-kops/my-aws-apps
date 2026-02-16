import { NextRequest, NextResponse } from 'next/server';

// GET: スコアを取得
export async function GET(request: NextRequest) {
  try {
    // TODO: AWS DynamoDBからスコアを取得する実装を追加
    // const scores = await getScoresFromDynamoDB();
    
    return NextResponse.json({
      success: true,
      message: 'スコア取得API（実装予定）',
      // data: scores,
    });
  } catch (error) {
    console.error('Error fetching scores:', error);
    return NextResponse.json(
      { success: false, error: 'スコアの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// POST: スコアを保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { score, level, lines, playerName } = body;

    // バリデーション
    if (typeof score !== 'number' || score < 0) {
      return NextResponse.json(
        { success: false, error: '無効なスコアです' },
        { status: 400 }
      );
    }

    // TODO: AWS DynamoDBにスコアを保存する実装を追加
    // await saveScoreToDynamoDB({
    //   score,
    //   level,
    //   lines,
    //   playerName: playerName || '匿名',
    //   timestamp: new Date().toISOString(),
    // });

    return NextResponse.json({
      success: true,
      message: 'スコア保存API（実装予定）',
      // data: { score, level, lines },
    });
  } catch (error) {
    console.error('Error saving score:', error);
    return NextResponse.json(
      { success: false, error: 'スコアの保存に失敗しました' },
      { status: 500 }
    );
  }
}
