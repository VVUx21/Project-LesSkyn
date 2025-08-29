'use server';
import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "./appwrite";
import { cookies } from "next/headers";
import { parseStringify } from "../utils";
const {
  APPWRITE_DATABASE_ID: DATABASE_ID,
  APPWRITE_USER_COLLECTION_ID: USER_COLLECTION_ID,
} = process.env;

interface getUserInfoProps {
  userId: string;
}

export const getUserInfo = async ({ userId }: getUserInfoProps) => {
  try {
    const { database } = await createAdminClient();
    
    const user = await database.listDocuments(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      [Query.equal('userId', userId)] 
    );
    
    if (!user.documents.length) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    return parseStringify(user.documents[0]);
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error; 
  }
};

export const getLoggedInUser = async () => {
  try {
    const { account } = await createSessionClient();
    
    const result = await account.get();
    const user = await getUserInfo({ userId: result.$id });
    
    return parseStringify(user);
  } catch (error) {
    console.error("Failed to retrieve logged-in user:", error);
    return null;
  }
};

export const logoutAccount = async () => {
  try {
    const { account } = await createSessionClient();
    
    // Delete session from Appwrite first
    await account.deleteSession('current');
    
    // Then delete the cookie
    (await cookies()).delete('appwrite-session');
    
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still delete cookie even if session deletion fails
    (await cookies()).delete('appwrite-session');
    
    return { 
      success: false, 
      error: typeof error === 'object' && error !== null && 'message' in error 
        ? (error as { message: string }).message 
        : String(error) 
    };
  }
};

interface signInProps {
  email_id: string;
  password: string;
}

export async function signin({ email_id, password }: signInProps) {
  try {
    const { account } = await createAdminClient();
    
    const session = await account.createEmailPasswordSession(email_id, password);
    
    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === 'production',
    });
    
    const user = await getUserInfo({ userId: session.userId });
    
    return parseStringify(user);
  } catch (error) {
    console.error('Signin error:', error);
    throw error; 
  }
}

interface SignUpParams {
  email_id: string;
  password: string;
  firstName: string;
  lastName: string;
  created_at: Date;
}

export async function signup({ password, ...userData }: SignUpParams) {
  const { email_id, firstName, lastName } = userData;
  let userAccount;
  
  try {
    const { account, database } = await createAdminClient();

    userAccount = await account.create(
      ID.unique(), 
      email_id, 
      password, 
      `${firstName} ${lastName}`
    );
    
    if (!userAccount) {
      throw new Error('Failed to create user account');
    }
    
    const newUser = await database.createDocument(
      DATABASE_ID!,
      USER_COLLECTION_ID!,
      ID.unique(),
      {
        ...userData,
        userId: userAccount.$id,
      }
    );
    
    const session = await account.createEmailPasswordSession(email_id, password);
    
    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === 'production',
    });
    
    return parseStringify(newUser);
  } catch (error) {
    console.error('Signup error:', error);
    
    if (
      userAccount &&
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string' &&
      (error as { message: string }).message.includes('document')
    ) {
      try {
        const { account } = await createAdminClient();
        await account.deleteIdentity(userAccount.$id);
        console.log('Cleaned up orphaned account');
      } catch (cleanupError) {
        console.error('Failed to cleanup account:', cleanupError);
      }
    }
    
    throw error;
  }
}