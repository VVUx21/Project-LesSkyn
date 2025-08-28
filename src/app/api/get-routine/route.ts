import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { client as redis } from '@/lib/server/redis'; // your Redis client file

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.APPWRITE_USERPROFILE_COLLECTION_ID!;

interface RoutineDocument {
  $id: string;
  $createdAt: string;
  skinType: string;
  skinConcern: string;
  routineType: string;
  generatedRoutine?: string | null;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const skinType = url.searchParams.get("skinType");
    const skinConcern = url.searchParams.get("skinConcern");

    if (!skinType || !skinConcern) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameters: skinType and skinConcern",
          processingTime: Date.now() - startTime,
        },
        { status: 400 }
      );
    }

    const cacheKey = `routine:${skinType.trim()}:${skinConcern.trim()}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit for ${cacheKey}`);
      return NextResponse.json(
        {
          success: true,
          data: JSON.parse(cached),
          metadata: {
            source: "cache",
            processingTime: Date.now() - startTime,
          },
        },
        { status: 200 }
      );
    }

    console.log(`🔍 Cache miss → querying Appwrite for ${cacheKey}`);

    const { database } = await createAdminClient();
    const response = await database.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal("skinType", skinType.trim()),
      Query.equal("skinConcern", skinConcern.trim()),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);

    if (response.documents.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Routine not ready yet",
          processingTime: Date.now() - startTime,
        },
        { status: 404 }
      );
    }

    const doc = response.documents[0];
    const routineDocument: RoutineDocument = {
      $id: doc.$id,
      $createdAt: doc.$createdAt,
      skinType: doc.skinType,
      skinConcern: doc.skinConcern,
      routineType: doc.routineType,
      generatedRoutine: doc.generatedRoutine,
    };

    const rawData = routineDocument.generatedRoutine;

    if (!rawData || rawData.trim() === "") {
      return NextResponse.json(
        {
          success: false,
          message: "Routine exists but has no data yet",
          metadata: {
            documentId: routineDocument.$id,
            createdAt: routineDocument.$createdAt,
            routineType: routineDocument.routineType,
            processingTime: Date.now() - startTime,
          },
        },
        { status: 404 }
      );
    }

    const routineData = JSON.parse(rawData);

    await redis.set(cacheKey, JSON.stringify(routineData), "EX", 3600);

    console.log(`✅ Routine cached under key ${cacheKey}`);

    return NextResponse.json(
      {
        success: true,
        data: routineData,
        metadata: {
          documentId: routineDocument.$id,
          createdAt: routineDocument.$createdAt,
          routineType: routineDocument.routineType,
          source: "database",
          processingTime: Date.now() - startTime,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: any) {
    console.error("❌ Error in get-routine API:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to fetch routine",
        processingTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
