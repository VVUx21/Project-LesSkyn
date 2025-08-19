import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/server/appwrite'; // Adjust import path as needed
import { Query } from 'node-appwrite';

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID!;
const COLLECTION_ID = process.env.APPWRITE_USERPROFILE_COLLECTION_ID!; // Your routines collection ID

interface RoutineDocument {
  $id: string;
  $createdAt: string;
  skinType: string;
  skinConcern: string;
  routineType: string;
  generatedRoutine?: string | null; // correct field
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

    console.log(`🔍 Searching for routine: skinType="${skinType}", skinConcern="${skinConcern}"`);

    const { database } = await createAdminClient();
    const response = await database.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal("skinType", skinType.trim()),
      Query.equal("skinConcern", skinConcern.trim()),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);

    if (response.documents.length === 0) {
      console.log("❌ No routine found in database");
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
    //console.log(rawData);

    if (!rawData || rawData.trim() === "") {
      console.warn(`⚠️ Routine found but data is empty. Document ID: ${routineDocument.$id}`);
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
    //console.log("Routine data parsed successfully:", routineData);

    console.log(`✅ Routine found! Document ID: ${routineDocument.$id}`);

    return NextResponse.json(
      {
        success: true,
        data: routineData,
        metadata: {
          documentId: routineDocument.$id,
          createdAt: routineDocument.$createdAt,
          routineType: routineDocument.routineType,
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

export const runtime = "nodejs";