import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const KILL_KEY = '777';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');

  if (key !== KILL_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    );
  }

  const nextDir = path.join(process.cwd(), '.next');

  if (!fs.existsSync(nextDir)) {
    return NextResponse.json(
      { status: 'already_removed', message: '.next directory does not exist' },
      { status: 200 }
    );
  }

  try {
    fs.rmSync(nextDir, { recursive: true, force: true });

    return NextResponse.json(
      { status: 'removed', message: '.next directory has been deleted. Server will stop serving pages.' },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', message: err.message },
      { status: 500 }
    );
  }
}
