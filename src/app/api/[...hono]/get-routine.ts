import { Hono } from 'hono';
import { createAdminClient } from '@/lib/server/appwrite';
import { Query } from 'node-appwrite';
import { client as redis } from '@/lib/server/redis'; 

const getRoutine = new Hono();

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID as string;
const COLLECTION_ID = process.env.APPWRITE_USERPROFILE_COLLECTION_ID as string;

interface RoutineDocument {
  $id: string;
  $createdAt: string;
  skinType: string;
  skinConcern: string;
  routineType: string;
  generatedRoutine?: string | null;
}

getRoutine.get('/get-routine', async (c) => {
  const startTime = Date.now();
  const skinType = c.req.query('skinType');
  const skinConcern = c.req.query('skinConcern');

  if (!skinType || !skinConcern) {
    return c.json({
      success: false,
      error: "Missing required parameters: skinType and skinConcern",
      processingTime: Date.now() - startTime,
    }, 400);
  }

  const cacheKey = `routine:${skinType.trim()}:${skinConcern.trim()}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    console.log(`⚡ Cache hit for ${cacheKey}`);
    return c.json({
      success: true,
      data: JSON.parse(cached),
      metadata: {
        source: "cache",
        processingTime: Date.now() - startTime,
      },
    });
  }

  console.log(`🔍 Cache miss → querying Appwrite for ${cacheKey}`);

  try {
    const { database } = await createAdminClient();
    const response = await database.listDocuments(DATABASE_ID, COLLECTION_ID, [
      Query.equal("skinType", skinType.trim()),
      Query.equal("skinConcern", skinConcern.trim()),
      Query.orderDesc("$createdAt"),
      Query.limit(1),
    ]);

    if (response.documents.length === 0) {
      return c.json({
        success: false,
        message: "Routine not ready yet",
        processingTime: Date.now() - startTime,
      }, 404);
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
      console.warn(`⚠️ Routine found but data is empty. Document ID: ${routineDocument.$id}`);
      return c.json({
        success: false,
        message: "Routine exists but has no data yet",
        metadata: {
          documentId: routineDocument.$id,
          createdAt: routineDocument.$createdAt,
          routineType: routineDocument.routineType,
          processingTime: Date.now() - startTime,
        },
      }, 404);
    }

    const routineData = JSON.parse(rawData);
    await redis.set(cacheKey, JSON.stringify(routineData), "EX", 3600);
    console.log(`✅ Routine cached under key ${cacheKey}`);

    return c.json({
      success: true,
      data: routineData,
      metadata: {
        documentId: routineDocument.$id,
        createdAt: routineDocument.$createdAt,
        routineType: routineDocument.routineType,
        source: "database",
        processingTime: Date.now() - startTime,
      },
    }, 200);

  } catch (error: any) {
    console.error("❌ Error in get-routine API:", error);
    return c.json({
      success: false,
      error: error.message || "Failed to fetch routine",
      processingTime: Date.now() - startTime,
    }, 500);
  }
});

export default getRoutine;