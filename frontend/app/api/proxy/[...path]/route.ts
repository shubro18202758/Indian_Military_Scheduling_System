import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = 'http://backend:8000';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  // Preserve query parameters
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/${path}${searchParams ? '?' + searchParams : ''}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  // Preserve query parameters
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/${path}${searchParams ? '?' + searchParams : ''}`;

  // Handle optional body - some endpoints don't require a body
  let body = null;
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // No body or invalid JSON, that's fine for some endpoints
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 503 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${BACKEND_URL}/api/${path}${searchParams ? '?' + searchParams : ''}`;

  let body = null;
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // No body or invalid JSON
  }

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join('/');
  const url = `${BACKEND_URL}/api/${path}`;

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 503 });
  }
}
