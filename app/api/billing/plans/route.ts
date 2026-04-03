import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * GET /api/billing/plans
 * Fetch all public plans
 * Used by pricing page during ISR build
 */
export async function GET() {
  try {
    const response = await fetch(`${API_BASE_URL}/billing/plans/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for 5 minutes (ISR will handle revalidation)
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing plans' },
      { status: 500 },
    );
  }
}
